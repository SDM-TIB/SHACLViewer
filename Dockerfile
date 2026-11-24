FROM python:3.12.16-slim-trixie

WORKDIR /SHACLViewer

COPY requirements.txt constraints.txt ./
RUN python -m pip install --upgrade pip==26.3.* &&\
    python -m pip install --no-cache-dir -r requirements.txt -c constraints.txt

COPY . .

ENV FLASK_APP=run.py
ENV PYTHONUNBUFFERED=1
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5001

CMD flask run
