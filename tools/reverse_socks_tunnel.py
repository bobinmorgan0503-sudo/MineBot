import os
import select
import socket
import struct
import threading
import time

import paramiko


SSH_HOST = os.environ["MINEBOT_TUNNEL_SSH_HOST"]
SSH_USER = os.environ["MINEBOT_TUNNEL_SSH_USER"]
SSH_PASSWORD = os.environ["MINEBOT_TUNNEL_SSH_PASSWORD"]
REMOTE_BIND_HOST = os.environ.get("MINEBOT_TUNNEL_BIND_HOST", "127.0.0.1")
REMOTE_BIND_PORT = int(os.environ.get("MINEBOT_TUNNEL_BIND_PORT", "1081"))
LOG_PATH = os.environ.get("MINEBOT_TUNNEL_LOG", os.path.join(os.getcwd(), "reverse-socks.log"))


def log(message):
    with open(LOG_PATH, "a", encoding="utf-8") as handle:
        handle.write(time.strftime("%Y-%m-%d %H:%M:%S ") + message + "\n")


def recvn(channel, length):
    data = b""
    while len(data) < length:
        chunk = channel.recv(length - len(data))
        if not chunk:
            raise EOFError("channel closed")
        data += chunk
    return data


def send_fail(channel, code=1):
    try:
        channel.sendall(b"\x05" + bytes([code]) + b"\x00\x01\x00\x00\x00\x00\x00\x00")
    except Exception:
        pass


def relay(channel, upstream):
    try:
        while True:
            readable, _, _ = select.select([channel, upstream], [], [], 60)
            if channel in readable:
                data = channel.recv(65536)
                if not data:
                    break
                upstream.sendall(data)
            if upstream in readable:
                data = upstream.recv(65536)
                if not data:
                    break
                channel.sendall(data)
    finally:
        try:
            upstream.close()
        except Exception:
            pass
        try:
            channel.close()
        except Exception:
            pass


def handle_channel(channel):
    upstream = None
    try:
        version, method_count = recvn(channel, 2)
        recvn(channel, method_count)
        if version != 5:
            raise ValueError("not a SOCKS5 client")
        channel.sendall(b"\x05\x00")

        version, command, _, address_type = recvn(channel, 4)
        if version != 5 or command != 1:
            send_fail(channel, 7)
            return

        if address_type == 1:
            address = socket.inet_ntoa(recvn(channel, 4))
        elif address_type == 3:
            length = recvn(channel, 1)[0]
            address = recvn(channel, length).decode("idna")
        elif address_type == 4:
            address = socket.inet_ntop(socket.AF_INET6, recvn(channel, 16))
        else:
            send_fail(channel, 8)
            return

        port = struct.unpack("!H", recvn(channel, 2))[0]
        log(f"CONNECT {address}:{port}")
        upstream = socket.create_connection((address, port), timeout=20)
        channel.sendall(b"\x05\x00\x00\x01\x00\x00\x00\x00\x00\x00")
        relay(channel, upstream)
    except Exception as error:
        log(f"ERROR {error!r}")
        send_fail(channel)
        try:
            channel.close()
        except Exception:
            pass
        if upstream:
            try:
                upstream.close()
            except Exception:
                pass


def run_once():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=SSH_HOST,
        username=SSH_USER,
        password=SSH_PASSWORD,
        timeout=20,
        auth_timeout=20,
        banner_timeout=20,
        look_for_keys=False,
        allow_agent=False
    )

    transport = client.get_transport()
    transport.set_keepalive(30)
    transport.request_port_forward(REMOTE_BIND_HOST, REMOTE_BIND_PORT)
    log(f"remote SOCKS listening on {REMOTE_BIND_HOST}:{REMOTE_BIND_PORT}")

    while transport.is_active():
        channel = transport.accept(10)
        if channel is None:
            continue
        threading.Thread(target=handle_channel, args=(channel,), daemon=True).start()


def main():
    while True:
        try:
            run_once()
        except Exception as error:
            log(f"RECONNECT {error!r}")
            time.sleep(5)


if __name__ == "__main__":
    main()
