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

> [!NOTE]
> If you receive a message from Docker saying `shaclviewer Warning pull access denied for sdmtib/shaclviewer, repository does not exist or may require 'docker login'`, this is caused by us not puhsing any image of the SHACLViewer yet.
> You can fix it by building the image yourself by running:
> ```bash
> docker-compose -f example/docker-compose.yml up -d --build
> ```

Alternatively, the example can be started or stopped with their respective commands as follows:

```bash
make example-run
make example-stop
```

## Embedding into another Flask application
The SHACLViewer is a Flask blueprint and can be mounted into an existing application instead of running its own server:

```python
from flask import Flask, abort
import shaclviewer

app = Flask(__name__)

def only_logged_in_users():
    if not user_is_logged_in():  # your own check
        abort(401)

shaclviewer.init_app(
    app,
    url_prefix='/shacl',                  # the viewer is then served at /shacl
    shapes_dir='/data/shapes',            # directory with the SHACL shape schemas
    allowed_endpoints=['http://triplestore:9000/sparql'],
    access_check=only_logged_in_users,
)
```

| Option              | Environment variable             | Default                    |
|---------------------|----------------------------------|----------------------------|
| `shapes_dir`        | `SHACLVIEWER_SHAPES_DIR`         | `/shapes`                  |
| `output_dir`        | `SHACLVIEWER_OUTPUT_DIR`         | in the temporary directory |
| `allowed_endpoints` | `SHACLVIEWER_ALLOWED_ENDPOINTS`  | any http(s) endpoint       |
| `access_check`      | –                                | none                       |

The environment variables are used if the option is neither given to `init_app` nor set in `app.config` (as `SHACLVIEWER_*`).
`SHACLVIEWER_ALLOWED_ENDPOINTS` is a comma-separated list.

> [!IMPORTANT]
> The SPARQL endpoint is chosen in the browser, but queried by the server.
> By default, any http(s) endpoint is accepted, which is what the standalone viewer needs, but it also means that users can make the server send requests to any address it can reach.
> When embedding the viewer, or running it for users you do not trust, set `allowed_endpoints`.
> The viewer only forwards SPARQL `SELECT` queries and takes nothing but the endpoint, the target query, and the target shape from the browser;
> shape schemas are only read from `shapes_dir`.
>
> Use `access_check` to restrict who can use the viewer.
> It is called before every request to the viewer and works like a Flask `before_request` function.
> The viewer does not implement CSRF protection; if your application authenticates with cookies, check the `Origin` header or the CSRF token in `access_check`.

## Publications
The underlying work is reported in:

1. Hany Alom. _A Library for Visualizing SHACL over Knowledge Graphs_. Master's Thesis, Leibniz Universität Hannover, March 2022. DOI: [10.15488/11944](https://doi.org/10.15488/11944)
