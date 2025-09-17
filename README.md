# iyp-browser

IYP Browser is our custom browser for querying the IYP. It serves as an alternative to the Neo4J browser and includes unique features such as query sharing and editor intelligence.

## Project Setup

To set up the project, run the following command:

```sh
npm install
```

### Compile and Hot-Reload for Development

To start the development server with hot-reloading, use:

```sh
npm run dev
```

### Compile and Minify for Production

To build the project for production, execute:

```sh
npm run build
```

## Project Deployment

To deploy the project using Docker, follow these steps:

### Clone the project in localhost

First, clone the repository:

```sh
git clone https://github.com/InternetHealthReport/iyp-browser.git
cd iyp-browser
```

### Build the Docker Image

Next, build the Docker image:

```sh
docker build -t iyp-browser .
```

### Run the Docker Container

Run the Docker container with the following command:

```sh
docker run --name iyp-browser -d -p <host-port>:80 -t iyp-browser
```

Replace `<host-port>` with the port on your host machine where you want to expose the application. After running the container, you can access it at `http://localhost:<host-port>/browser`. The project will be deployed in a subpath.

#### Subpath Modification (Optional)

If you want to change or remove the subpath, please modify the following files:

- `src/plugins/GlobalVariables.js`
- `Dockerfile`
- `default.conf`

Make sure to update the relevant configurations in each file to reflect the desired changes to the subpath.

### Configure Nginx Reverse Proxy

If you want to serve the application behind an Nginx proxy, you need to configure the proxy to point to `http://localhost:<host-port>` while ensuring that the location is set to `/browser`.

To complete the configuration, add the following rules to prevent caching of static files. This ensures that requests for static files do not redirect to the main page but remain within the subpath:

```nginx
location ~* .* {
    proxy_no_cache 1;
    proxy_cache_bypass 1;
    proxy_pass       http://localhost:<host-port>;
}
```
