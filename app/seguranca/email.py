# -*- coding: utf-8 -*-
"""Envio de e-mail por SMTP (variáveis de ambiente). Sem SMTP configurado, não envia — e a
aplicação NUNCA mostra na tela o link de redefinição a quem pediu (defeito do portal antigo)."""
import re
import smtplib
from email.message import EmailMessage

from flask import current_app

_EMAIL_OK = re.compile(r'^[^@\s<>"\r\n,;]+@[^@\s<>"\r\n,;]+\.[^@\s<>"\r\n,;]+$')


def configurado():
    c = current_app.config
    return bool(c['SMTP_HOST'] and c['SMTP_FROM'])


def valido(endereco):
    """Rejeita quebra de linha e separadores (injeção de cabeçalho)."""
    return bool(endereco) and len(endereco) <= 254 and bool(_EMAIL_OK.match(endereco))


def enviar(para, assunto, texto):
    if not configurado() or not valido(para):
        return False
    c = current_app.config
    msg = EmailMessage()
    msg['From'] = c['SMTP_FROM']
    msg['To'] = para
    msg['Subject'] = assunto.replace('\r', ' ').replace('\n', ' ')
    msg.set_content(texto)
    try:
        with smtplib.SMTP(c['SMTP_HOST'], c['SMTP_PORT'], timeout=20) as s:
            if c['SMTP_USE_TLS']:
                s.starttls()
            if c['SMTP_USER']:
                s.login(c['SMTP_USER'], c['SMTP_PASSWORD'])
            s.send_message(msg)
        return True
    except Exception as e:  # falha de e-mail nunca derruba a requisição
        current_app.logger.warning('falha ao enviar e-mail: %s', e)
        return False
