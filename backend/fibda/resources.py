import sys
from pathlib import Path


def resource_path(*parts):
    root = Path(sys._MEIPASS) if getattr(sys, 'frozen', False) else Path(__file__).resolve().parents[2]
    return root.joinpath(*parts)
