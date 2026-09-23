#!/usr/bin/env python3
"""Build the offline Pyodide script elements; no network during build or use."""
import argparse
import base64
import hashlib
import json
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
RUNTIME = APP / "standalone" / "runtime"
VERSION = "0.28.3"


def script_text(text):
    return text.replace("</script", "<\\/script")


def build_runtime_scripts(files=None):
    manifest = json.loads((RUNTIME / "manifest.json").read_text())
    for asset in manifest["files"]:
        payload = (RUNTIME / asset["path"]).read_bytes()
        if hashlib.sha256(payload).hexdigest() != asset["sha256"]:
            raise RuntimeError("Runtime asset checksum mismatch: " + asset["path"])
    loader = (RUNTIME / "pyodide.js").read_text()
    replacements = {
        "instantiateWasm:Ce(e.indexURL)": "instantiateWasm:Ce(e.indexURL,e._wasmBinary)",
        'function Ce(e){if(typeof WasmOffsetConverter<"u")return;let{binary:t,response:r}=_(e+"pyodide.asm.wasm")':
        'function Ce(e,b){if(typeof WasmOffsetConverter<"u")return;let{binary:t,response:r}=b?{binary:Promise.resolve(b)}:_(e+"pyodide.asm.wasm")',
    }
    # Keep Pyodide's sentinel imports and initialization; replace only its WASM fetch.
    for needle, replacement in replacements.items():
        if loader.count(needle) != 1:
            raise RuntimeError("Pinned Pyodide loader changed: review offline WASM adapter.")
        loader = loader.replace(needle, replacement)
    assets = {
        "wasm": base64.b64encode((RUNTIME / "pyodide.asm.wasm").read_bytes()).decode(),
        "stdlib": base64.b64encode((RUNTIME / "python_stdlib.zip").read_bytes()).decode(),
        "lock": json.loads((RUNTIME / "pyodide-lock.json").read_text()),
        "files": files or {},
        "wheels": {p.name: base64.b64encode(p.read_bytes()).decode()
                   for p in sorted((RUNTIME / "wheels").glob("*.whl"))},
    }
    return "\n".join([
        '<script type="application/json" id="fibda-runtime-licenses">'
        + json.dumps({p.name: p.read_text() for p in sorted(RUNTIME.glob("LICENSE-*"))},
                     ensure_ascii=True).replace("<", "\\u003c") + "</script>",
        '<script type="application/json" id="fibda-python-assets">'
        + json.dumps(assets, ensure_ascii=True).replace("<", "\\u003c") + "</script>",
        "<script>" + script_text((RUNTIME / "pyodide.asm.js").read_text()) + "</script>",
        "<script>" + script_text(loader) + "</script>",
        "<script>" + script_text((RUNTIME / "runtime.js").read_text()) + "</script>",
    ])


def build_proof():
    files = {
        "/home/pyodide/fibda/__init__.py": "",
        "/home/pyodide/fibda/domain.py": (APP / "backend/fibda/domain.py").read_text(),
        "/home/pyodide/fibda/catalogue.py": (APP / "backend/fibda/catalogue.py").read_text(),
        "/home/pyodide/fibda/catalogue.json": (APP / "backend/fibda/catalogue.json").read_text(),
        "/home/pyodide/test_domain.py": (APP / "backend/tests/test_domain.py").read_text(),
        "/home/pyodide/test_catalogue.py": (APP / "backend/tests/test_catalogue.py").read_text(),
        "/home/pyodide/proof_bridge.py": (RUNTIME / "proof_bridge.py").read_text(),
    }
    head = """<!doctype html><html lang="fr"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; connect-src blob:"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preuve FIBDA Python autonome</title><style>body{font:18px system-ui;background:#e2ede6;color:#192c2b;margin:2rem}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Python FIBDA entièrement embarqué</h1><p id="status">Initialisation…</p><pre id="proof"></pre>"""
    tail = """<script>
window.__proofPromise = (async () => {
  try {
    const runtime = await FIBDAPythonRuntime.boot();
    const result = await runtime.evaluateJson(`{
      "arithmetic": 2 + 2,
      "stdlib": {"decimal": str(__import__("decimal").Decimal("0.1") + __import__("decimal").Decimal("0.2")),
                 "fraction": str(__import__("fractions").Fraction(1, 3)),
                 "date": __import__("datetime").date(2027, 1, 1).isoformat(),
                 "uuid": str(__import__("uuid").uuid4()),
                 "sha256": __import__("hashlib").sha256(b"FIBDA").hexdigest()},
      "domain": __import__("fibda.domain", fromlist=["rank_ballots"]).rank_ballots(
        {str(j): ["a", "b"] for j in range(5)}, ["a", "b"], "0")
    }`);
    const extra = await runtime.call('proof_bridge', 'verify', {label:'FIBDA'});
    window.__runtimeProof = {ok: result.arithmetic === 4 && extra.tests.success && extra.xlsx.rows[1][0] === 'FIBDA', version: runtime.version, protocol: location.protocol, result, extra};
    document.querySelector('#status').textContent = 'Réussi — aucun serveur Python ni téléchargement requis';
    document.querySelector('#status').id = 'done';
    document.querySelector('#proof').textContent = JSON.stringify(window.__runtimeProof, null, 2);
  } catch(error) {
    window.__runtimeProof = {ok:false, error:String(error), stack:error.stack};
    document.querySelector('#status').textContent = 'Échec';
    document.querySelector('#proof').textContent = JSON.stringify(window.__runtimeProof, null, 2);
  }
})();
</script></html>"""
    destination = RUNTIME / "proof-offline.html"
    destination.write_text(head + build_runtime_scripts(files) + tail)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--proof", action="store_true")
    args = parser.parse_args()
    if args.proof:
        path = build_proof()
        print(json.dumps({"file": str(path), "bytes": path.stat().st_size,
                          "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}))
    else:
        print(build_runtime_scripts())
