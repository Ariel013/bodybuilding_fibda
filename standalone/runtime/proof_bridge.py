"""Reproducible browser-only checks for the offline runtime."""
import io
import sys
import unittest
import openpyxl
import test_catalogue
import test_domain


def verify(payload):
    workbook = openpyxl.Workbook()
    workbook.active.append(["Athlète", "Total"])
    workbook.active.append([payload["label"], 12])
    content = io.BytesIO()
    workbook.save(content)
    content.seek(0)
    restored = openpyxl.load_workbook(content)
    suite = unittest.TestSuite([
        unittest.defaultTestLoader.loadTestsFromModule(test_domain),
        unittest.defaultTestLoader.loadTestsFromModule(test_catalogue),
    ])
    stream = io.StringIO()
    result = unittest.TextTestRunner(stream=stream).run(suite)
    return {
        "python": sys.version,
        "tests": {"success": result.wasSuccessful(), "count": result.testsRun,
                  "failures": len(result.failures), "errors": len(result.errors),
                  "output": stream.getvalue()},
        "xlsx": {"openpyxl": openpyxl.__version__, "bytes": len(content.getvalue()),
                 "rows": list(restored.active.values)},
    }
