# -*- coding: utf-8 -*-
"""Lembretes diários: encaminhamento vencido e não feito gera um e-mail por dia ao responsável.

Uma linha de execução leve, dentro do próprio processo, confere a cada meia hora. O "um por dia"
é garantido no banco (encaminhamentos.ultimo_aviso), não aqui: reiniciar o servidor ou ter dois
processos não duplica o e-mail. Desliga com APP55_LEMBRETES=0 (os testes nunca a ligam).
"""
import logging
import os
import threading
import time

INTERVALO = 30 * 60
_iniciado = False


def iniciar(app):
    global _iniciado
    if _iniciado or app.config.get('TESTING') or os.environ.get('APP55_LEMBRETES', '1') == '0':
        return
    _iniciado = True

    def laco():
        from .apresentacao import encaminhamentos as E
        time.sleep(60)                                   # deixa o servidor subir primeiro
        while True:
            try:
                with app.app_context():
                    n = E.avisar_atrasados(url=os.environ.get('APP55_URL', ''))
                    if n:
                        app.logger.info('lembretes: %d e-mail(s) de encaminhamento atrasado', n)
            except Exception:                            # um erro aqui não pode parar os próximos dias
                logging.getLogger(__name__).exception('lembretes de encaminhamento')
            time.sleep(INTERVALO)

    threading.Thread(target=laco, name='app55-lembretes', daemon=True).start()
