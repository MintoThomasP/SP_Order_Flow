import socket
import threading

def forward(src, dst):
    try:
        while True:
            data = src.recv(65536)
            if not data:
                break
            dst.sendall(data)
    except Exception:
        pass
    finally:
        try:
            src.close()
        except Exception:
            pass
        try:
            dst.close()
        except Exception:
            pass

def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('127.0.0.1', 8001))
    server.listen(50)
    while True:
        client_sock, _ = server.accept()
        target_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            target_sock.connect(('127.0.0.1', 8000))
            threading.Thread(target=forward, args=(client_sock, target_sock), daemon=True).start()
            threading.Thread(target=forward, args=(target_sock, client_sock), daemon=True).start()
        except Exception:
            client_sock.close()

if __name__ == '__main__':
    main()
