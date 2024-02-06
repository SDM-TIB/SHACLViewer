FROM python:3.12.1-slim-bookworm

WORKDIR /SHACLViewer

COPY requirements.txt requirements.txt
RUN python -m pip install --upgrade pip==24.0.* &&\
    python -m pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_APP=run.py
ENV PYTHONUNBUFFERED=1
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5001

CMD flask run
