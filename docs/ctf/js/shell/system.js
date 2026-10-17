// Monta o sistema de arquivos "base" da máquina simulada (estilo Ubuntu).

import { VFS } from './vfs.js';
import { COMMAND_NAMES } from './commands.js';

const BIN_CONTENT = '\x7fELF\u0002\u0001\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0003\u0000>\u0000\u0001\u0000\u0000\u0000@\u0010\u0000\u0000ÿÿ ×ª¬¶§ (binário simulado)\n';

const PASSWD = `root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
syslog:x:104:110::/home/syslog:/usr/sbin/nologin
mysql:x:105:113:MySQL Server:/nonexistent:/bin/false
aluno:x:1000:1000:Aluno PinguimCorp:/home/aluno:/bin/bash
tux:x:1001:1001:Tux,,,:/home/tux:/bin/bash
admin:x:1002:1002:Administrador:/home/admin:/bin/bash
`;

const GROUP = `root:x:0:
daemon:x:1:
sudo:x:27:admin
www-data:x:33:
aluno:x:1000:
tux:x:1001:
admin:x:1002:
`;

const OS_RELEASE = `PRETTY_NAME="PinguimOS 24.04 LTS (simulador educacional)"
NAME="PinguimOS"
VERSION_ID="24.04"
ID=pinguimos
ID_LIKE=ubuntu debian
HOME_URL="https://www.kernel.org/"
`;

const BASHRC = `# ~/.bashrc: executado pelo bash em shells interativos.
# Arquivos que começam com "." são ocultos: veja com  ls -a

# histórico
HISTSIZE=1000

# atalhos (aliases) — no Linux real, funcionam após "source ~/.bashrc"
alias ll='ls -la'
alias la='ls -A'

export EDITOR=nano
`;

const SYSLOG_MSGS = [
  'systemd[1]: Started Daily apt download activities.',
  'kernel: [ 0.000000] Linux version 6.8.0-pinguim',
  'CRON[812]: (root) CMD (test -x /usr/sbin/anacron)',
  'sshd[901]: Server listening on 0.0.0.0 port 22.',
  'nginx[1022]: error: connection refused while connecting to upstream',
  'systemd[1]: Starting Cleanup of Temporary Directories...',
  'kernel: [ 12.53101] EXT4-fs (sda1): mounted filesystem',
  'app-pinguim[1500]: erro: falha ao conectar no banco de dados',
  'app-pinguim[1500]: aviso: tentativa 2 de 5',
  'app-pinguim[1500]: conectado ao banco de dados',
  'systemd[1]: Finished Cleanup of Temporary Directories.',
  'nginx[1022]: GET /index.html 200',
  'nginx[1022]: GET /admin 403',
  'kernel: [ 98.11023] usb 1-1: new high-speed USB device',
  'CRON[1730]: (aluno) CMD (/home/aluno/backup.sh)',
  'app-pinguim[1500]: ERRO: disco quase cheio (92%)',
];

const AUTH_LOG = `out 15 22:01:13 pinguimcorp sshd[3301]: Failed password for root from 203.0.113.7 port 51022 ssh2
out 15 22:01:15 pinguimcorp sshd[3301]: Failed password for root from 203.0.113.7 port 51022 ssh2
out 15 22:01:18 pinguimcorp sshd[3301]: Failed password for admin from 203.0.113.7 port 51022 ssh2
out 15 22:05:40 pinguimcorp sshd[3355]: Accepted password for tux from 198.51.100.23 port 40112 ssh2
out 15 23:10:02 pinguimcorp sudo:    admin : TTY=pts/0 ; PWD=/home/admin ; USER=root ; COMMAND=/usr/bin/apt update
out 16 07:45:11 pinguimcorp sshd[4100]: Accepted password for aluno from 192.0.2.10 port 50500 ssh2
`;

export function buildSystem({ user = 'aluno', home = '/home/aluno', now = Date.now() } = {}) {
  const vfs = new VFS('root'); // monta como root e depois troca para o usuário
  const dir = (p, mode = 0o755, owner = 'root') => vfs.mkdir(p, { parents: true, mode, owner });
  const file = (p, content, mode = 0o644, owner = 'root', extra = {}) => {
    const n = vfs.writeFile(p, content, Object.assign({ mode, owner }, extra));
    n.group = owner;
    n.mtime = extra.mtime || now - 1000 * 60 * 60 * 24 * 30;
    return n;
  };

  ['/bin', '/usr/bin', '/usr/local/bin', '/usr/share', '/etc', '/var/log', '/var/www', '/opt', '/dev', '/home', '/mnt', '/media', '/srv', '/proc', '/sys', '/boot', '/lib'].forEach((d) => dir(d));
  dir('/root', 0o700);
  dir('/tmp', 0o777);

  for (const name of COMMAND_NAMES) {
    if (/^[a-z][a-z0-9]*$/.test(name)) {
      file('/usr/bin/' + name, BIN_CONTENT, 0o755, 'root', { exec: name });
      file('/bin/' + name, BIN_CONTENT, 0o755, 'root', { exec: name });
    }
  }
  file('/usr/bin/[', BIN_CONTENT, 0o755, 'root', { exec: '[' });

  const devnull = file('/dev/null', '', 0o666);
  devnull.device = 'null';

  file('/etc/passwd', PASSWD);
  file('/etc/group', GROUP);
  file('/etc/shadow', 'root:$6$y8Kq...:19700:0:99999:7:::\naluno:$6$Pz2...:19700:0:99999:7:::\n', 0o640);
  file('/etc/hostname', 'pinguimcorp\n');
  file('/etc/hosts', '127.0.0.1\tlocalhost\n127.0.1.1\tpinguimcorp\n');
  file('/etc/os-release', OS_RELEASE);
  file('/etc/shells', '# /etc/shells: shells de login válidos\n/bin/sh\n/bin/bash\n/usr/bin/bash\n');
  file('/etc/motd', 'Bem-vindo ao servidor da PinguimCorp! Use com responsabilidade.\n');
  file('/etc/resolv.conf', 'nameserver 1.1.1.1\nnameserver 8.8.8.8\n');
  file('/etc/host.conf', 'multi on\n');
  file('/etc/sysctl.conf', '# configurações do kernel\nnet.ipv4.ip_forward=0\n');
  file('/etc/adduser.conf', 'DSHELL=/bin/bash\nDHOME=/home\n');
  dir('/etc/ssh');
  file('/etc/ssh/sshd_config', 'Port 22\nPermitRootLogin no\nPasswordAuthentication yes\n');
  dir('/etc/nginx');
  file('/etc/nginx/nginx.conf', 'user www-data;\nworker_processes auto;\nhttp {\n  server { listen 80; root /var/www/html; }\n}\n');
  dir('/var/www/html');
  file('/var/www/html/index.html', '<h1>PinguimCorp</h1>\n<p>Em manutenção.</p>\n');

  const syslog = [];
  for (let i = 0; i < 60; i++) {
    const msg = SYSLOG_MSGS[(i * 7) % SYSLOG_MSGS.length];
    const h = 6 + Math.floor(i / 10);
    syslog.push('out 16 ' + String(h).padStart(2, '0') + ':' + String((i * 13) % 60).padStart(2, '0') + ':' + String((i * 29) % 60).padStart(2, '0') + ' pinguimcorp ' + msg);
  }
  file('/var/log/syslog', syslog.join('\n') + '\n', 0o644, 'root');
  file('/var/log/auth.log', AUTH_LOG, 0o640);

  // Outros usuários
  dir('/home/tux', 0o755, 'tux');
  file('/home/tux/leia.txt', 'Oi! Eu sou o Tux, o mascote do Linux. 🐧\nVocê consegue ler este arquivo porque ele tem permissão de leitura para "outros".\n', 0o644, 'tux');
  file('/home/tux/diario.txt', 'Querido diário... (você não deveria conseguir ler isto)\n', 0o600, 'tux');
  dir('/home/admin', 0o700, 'admin');
  file('/root/segredo.txt', 'Só o root lê isto.\n', 0o600);

  // Home do aluno
  dir(home, 0o755, user);
  file(home + '/.bashrc', BASHRC, 0o644, user);
  file(home + '/.profile', '# ~/.profile\nif [ -f ~/.bashrc ]; then . ~/.bashrc; fi\n', 0o644, user);
  dir(home + '/Documentos', 0o755, user);
  file(home + '/Documentos/notas.txt', 'Linux é um kernel.\nO shell interpreta comandos.\nO terminal é a janela.\n', 0o644, user);
  file(home + '/Documentos/compras.txt', 'banana\nmaçã\nleite\nbanana\npão\nleite\nbanana\ncafé\n', 0o644, user);
  file(home + '/Documentos/numeros.txt', '10\n2\n33\n7\n100\n25\n', 0o644, user);
  dir(home + '/Downloads', 0o755, user);
  for (const f of ['foto_praia.jpg', 'foto_festa.jpg', 'trabalho_final.pdf', 'musica.mp3', 'relatorio.txt', 'instalar.sh']) {
    file(home + '/Downloads/' + f, f.endsWith('.txt') ? 'Relatório de vendas — Q3\nTotal: 42 pinguins\n' : f.endsWith('.sh') ? '#!/bin/bash\necho "Instalando..."\n' : 'conteúdo binário de ' + f + '\n', 0o644, user);
  }
  dir(home + '/Imagens', 0o755, user);

  // Ajusta donos/grupos dos diretórios criados com mkdir -p
  vfs.walk('/', (n) => { if (!n.group || n.group === 'root') n.group = n.owner; });
  vfs.user = user;
  return vfs;
}
