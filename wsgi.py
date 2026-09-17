# -*- coding: utf-8 -*-
"""Ponto de entrada. Local: python wsgi.py (http://localhost:5055). Render: gunicorn wsgi:app."""
import os

from app import criar_app

app = criar_app()

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', '5055')), debug=os.environ.get('FLASK_DEBUG') == '1')
