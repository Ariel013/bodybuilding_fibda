"""Charge ASGI en mémoire : 40 clients, SQLite réel, aucun réseau/terminal réel."""
import concurrent.futures
import tempfile
import threading
import time
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from fibda.app import create_app, COOKIE
from fibda.auth import add_user, new_session
from fibda.store import commands, audit
from fibda.workflow import make_round


class CapacityTests(unittest.TestCase):
    def test_40_clients_100_ranks_persist_and_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            app=create_app(directory, testing=True, clock=lambda:1000)
            store=app.state.store
            def seed(conn):
                state=store.read_conn(conn)
                accounts=[add_user(store,conn,f'Client {i}', ['chief' if i==0 else 'judge' if i<11 else 'trainee'],f'Capacity-client-{i:03d}',True) for i in range(40)]
                tokens=[new_session(store,conn,u['id']) for u in accounts]
                panel=[u['id'] for u in accounts[:11]]
                state['jury']={'panel':panel,'trainees':[u['id'] for u in accounts[11:]],'withdrawal_order':panel[1:]}
                category={'id':'load-category','name':'Charge 100','discipline':'bodybuilding','section':'amateur','order':0}
                state['categories']=[category]
                ids=[f'entry-{i:03d}' for i in range(100)]
                state['people']=[{'id':i,'first_name':i,'last_name':'Charge','nationalities':['CI']} for i in ids]
                state['entries']=[{'id':i,'person_id':i,'category_id':category['id'],'confirmed':True,'bib':n+1} for n,i in enumerate(ids)]
                round_=make_round(state,category,'final',ids)
                round_.update(status='open',opened_at=1000)
                state.update(status='running',rounds=[round_],active_round_id=round_['id'])
                store.write(conn,state)
                return tokens,accounts,ids,round_['id'],state['restore_id']
            tokens,accounts,ids,rid,restore=store.transact(seed)
            requests=[{'id':f'load-vote-{i}','version':0,'type':'ballot.submit','payload':{'round_id':rid,'restore_id':restore,'ranking':ids[i:]+ids[:i]}} for i in range(40)]
            barrier=threading.Barrier(40)
            def send(i):
                client=TestClient(app)
                client.cookies.set(COOKIE,tokens[i])
                try:
                    barrier.wait(timeout=30)
                    started=time.perf_counter()
                    response=client.post('/api/v1/command',json=requests[i])
                    return response.status_code,response.json(),time.perf_counter()-started
                finally:
                    client.close()
            with TestClient(app):
                started=time.perf_counter()
                with concurrent.futures.ThreadPoolExecutor(max_workers=40) as pool:
                    responses=list(pool.map(send,range(40)))
                elapsed=time.perf_counter()-started
                self.assertEqual([r[0] for r in responses],[200]*40)
                state=store.read();round_=state['rounds'][0]
                self.assertEqual(state['version'],40)
                self.assertEqual(len(round_['ballots']),40)
                self.assertEqual(round_['status'],'awaiting_validation')
                self.assertTrue(round_['transitioned'])
                for i,account in enumerate(accounts):
                    self.assertEqual(round_['ballots'][account['id']]['original']['ranking'],requests[i]['payload']['ranking'])
                with store.engine.connect() as conn:
                    self.assertEqual(conn.scalar(select(func.count()).select_from(commands)),40)
                    self.assertEqual(conn.scalar(select(func.count()).select_from(audit)),40)
                before=state
            # Nouvelle application et nouveau moteur SQL, même fichier SQLite et sessions.
            restarted=create_app(directory,testing=True,clock=lambda:1001)
            with TestClient(restarted) as client:
                client.cookies.set(COOKIE,tokens[0])
                self.assertEqual(client.get('/api/v1/state').status_code,200)
                self.assertEqual(restarted.state.store.read(),before)
                replay=client.post('/api/v1/command',json=requests[0])
                self.assertEqual(replay.status_code,200)
                self.assertEqual(restarted.state.store.read(),before)
                self.assertEqual(client.get('/api/v1/public/main').json()['scene']['kind'],'idle')
            latencies=sorted(r[2] for r in responses)
            print(f'ASGI simulation: 40/40 accepted, 100 ranks each; batch={elapsed:.3f}s; p95={latencies[37]:.3f}s; max={latencies[-1]:.3f}s; SQLite restart and replay OK')
