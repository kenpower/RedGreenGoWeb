from http.server import BaseHTTPRequestHandler, HTTPServer

class CORSRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Print request details
        print(f"Request received: {self.command} {self.path}")
        print(f"Headers: {self.headers}")

        allowed_origins = ['http://localhost:8080', 'https://kenpower.github.io']
        # Allow CORS from a specific domain

        origin = self.headers.get('Origin')
        if origin in allowed_origins:
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            files = list_files_in_directory('.')
            cont = read_file("rgg.py")
            response = f'{{"message": "Welcome to the CORS-enabled server!", "f",{cont}}}'
            self.wfile.write(response.encode('utf-8'))
        else:
            self.send_response(403)
            self.end_headers()
        
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "https://kenpower.github.io")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        


import os
def list_files_in_directory(directory):
    # List all files in the specified directory
    files = [f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))]
    return files

def read_file(file_path):
    with open(file_path, 'r') as file:
        content = file.read()
    return content

def run(server_class=HTTPServer, handler_class=CORSRequestHandler, port=8000):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f'Starting server on port {port}...')
    httpd.serve_forever()

if __name__ == "__main__":
    run()
