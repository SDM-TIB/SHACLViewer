# SHACLViewer Example

There are some example SHACL shape schemas in the `shapes` directory.
An example RDF knowledge graph is created with the data in `data` and will be accessible via [http://localhost:17000/sparql](http://localhost:17000/sparql).

In order for the example to work, Docker has to be installed.
Afterward, the containers can be started with `docker-compose up -d`.
The SHACLViewer is accessible at [http://localhost:5001](http://localhost:5001).
When trying the validation of the LUBM SHACL schema, use `http://lubm:8890/sparql` as the URL for the SPARQL endpoint of LUBM.