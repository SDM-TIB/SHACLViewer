[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

# SHACLViewer

SHACLViewer is a Web application for interactive visualizations of SHACL shape schemas.

## Example
Example data and SHACL shapes are provided in the `example` directory.
Docker is required for the example to run.
Assuming the current working directory is the root of this repository, the example can be started with

```bash
docker-compose -f example/docker-compose.yml up -d
```

The SHACLViewer is then served at [http://localhost:5001](http://localhost:5001).

Alternatively, the example can be started or stopped with their respective commands as follows:

```bash
make example-run
make example-stop
```

## Publications
The underlying work is reported in:

1. Hany Alom. _A Library for Visualizing SHACL over Knowledge Graphs_. Master's Thesis, Leibniz Universität Hannover, March 2022. DOI: [10.15488/11944](https://doi.org/10.15488/11944)
