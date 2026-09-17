FROM python:3.13-slim

# fuso de Brasília: todas as datas de competência e da auditoria são locais
ENV TZ=America/Sao_Paulo
RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

# 1 worker (SQLite + 512 MB do Starter) com threads; o processamento de bases roda em subprocesso
CMD gunicorn wsgi:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 180
