# -*- coding: utf-8 -*-
"""Configuração. Tudo que muda entre máquina local e Render vem de variável de ambiente."""
import os
import secrets
from datetime import timedelta

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _bool(nome, padrao=False):
    v = os.environ.get(nome)
    return padrao if v is None else v.strip().lower() in ('1', 'true', 'sim', 'yes', 'on')


class Config:
    DATA_DIR = os.environ.get('APP55_DATA_DIR') or os.path.join(RAIZ, 'data')
    DB_PATH = os.path.join(DATA_DIR, 'app55.db')
    # dados das competências (mês fechado) — separado do banco para os testes usarem os dados reais
    COMPETENCIAS_DIR = os.environ.get('APP55_COMPETENCIAS_DIR') or os.path.join(DATA_DIR, 'competencias')

    # sessão
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    # só vira True em produção (HTTPS); com Secure em http://localhost o cookie não volta
    SESSION_COOKIE_SECURE = _bool('APP55_COOKIE_SEGURO', False)
    SESSION_COOKIE_NAME = '__Host-app55' if SESSION_COOKIE_SECURE else 'app55'
    SESSION_REFRESH_EACH_REQUEST = False
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)
    SESSAO_ABSOLUTA_HORAS = 8          # desde o login, nunca renovada por uso
    SESSAO_INATIVIDADE_MIN = 60

    # login e senha
    SENHA_MIN = 10
    SENHA_MAX = 128
    BLOQUEIO_FALHAS = 5
    BLOQUEIO_MINUTOS = 15
    LIMITE_IP_TENTATIVAS = 15          # por IP, na janela abaixo (login e esqueci-senha)
    LIMITE_IP_JANELA_MIN = 5
    RESET_TOKEN_MIN = 30

    # proxy / https (Render termina o TLS na frente da aplicação)
    TRUST_PROXY = _bool('APP55_TRUST_PROXY', False)
    FORCE_HTTPS = _bool('APP55_FORCE_HTTPS', False)

    # e-mail
    SMTP_HOST = os.environ.get('SMTP_HOST', '')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', '587') or 587)
    SMTP_USER = os.environ.get('SMTP_USER', '')
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
    SMTP_FROM = os.environ.get('SMTP_FROM', '')
    SMTP_USE_TLS = _bool('SMTP_USE_TLS', True)
    APP_BASE_URL = (os.environ.get('APP_BASE_URL') or 'http://localhost:5055').rstrip('/')

    MAX_CONTENT_LENGTH = 25 * 1024 * 1024


def carregar_chave_secreta(data_dir):
    """SECRET_KEY estável: da variável de ambiente ou de data/.secret_key (criada uma vez).
    Trocar a chave derruba todas as sessões — no Render ela vem sempre do ambiente."""
    k = os.environ.get('APP55_SECRET_KEY')
    if k:
        return k
    os.makedirs(data_dir, exist_ok=True)
    caminho = os.path.join(data_dir, '.secret_key')
    if os.path.exists(caminho):
        return open(caminho, encoding='utf-8').read().strip()
    k = secrets.token_hex(32)
    with open(caminho, 'w', encoding='utf-8') as f:
        f.write(k)
    return k
