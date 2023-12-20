# Makefile for building SHACLViewer

.PHONY: help install bundle outdated run-example stop-example example-run example-stop

help:
	@echo "Please use \`make <target>' where <target> is one of"
	@echo "  install        to install all build dependencies"
	@echo "  bundle         to pack all dependencies for use in the tool"
	@echo "  outdated   to list all outdated dependencies"
	@echo "  run-example    to build a fresh Docker image and run the example containers"
	@echo "  stop-example   to stop all example containers and remove their data"

install:
	python3 -m pip install -r requirements-dev.txt
	npm i

bundle:
	python3 bundle-assets.py

outdated:
	python3 -m pip list --outdated
	npm outdated || true

run-example:
	docker-compose -f example/docker-compose.yml up -d --build

example-run: run-example

stop-example:
	docker-compose -f example/docker-compose.yml down -v

example-stop: stop-example
