# -*- coding: utf-8 -*-
"""Hash e política de senha (base: auth/password.py do Release Builder, com teto de tamanho)."""
import re
import secrets
import string

from werkzeug.security import check_password_hash, generate_password_hash

MIN = 10
MAX = 128          # sem teto, uma senha de megabytes vira ataque de custo no scrypt

# usado para gastar o mesmo tempo quando o login não existe (não revela quem existe)
HASH_ISCA = generate_password_hash('isca-' + secrets.token_hex(8))


def gerar_hash(senha):
    return generate_password_hash(senha)


def conferir(senha, senha_hash):
    if not senha_hash or senha is None or len(senha) > MAX:
        return False
    try:
        return check_password_hash(senha_hash, senha)
    except Exception:
        return False


def validar_politica(senha):
    if not senha or len(senha) < MIN:
        return False, 'A senha deve ter no mínimo %d caracteres.' % MIN
    if len(senha) > MAX:
        return False, 'A senha deve ter no máximo %d caracteres.' % MAX
    if not re.search(r'[A-Z]', senha):
        return False, 'A senha deve ter ao menos uma letra maiúscula.'
    if not re.search(r'[a-z]', senha):
        return False, 'A senha deve ter ao menos uma letra minúscula.'
    if not re.search(r'[0-9]', senha):
        return False, 'A senha deve ter ao menos um número.'
    return True, ''


def gerar_provisoria(tamanho=14):
    # sem caracteres que se confundem ao ler (0/O, 1/l/I)
    alfabeto = ''.join(c for c in string.ascii_letters + string.digits if c not in '0O1lI')
    while True:
        s = ''.join(secrets.choice(alfabeto) for _ in range(tamanho))
        if validar_politica(s)[0]:
            return s
