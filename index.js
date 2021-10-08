var os = require('os');
var fs = require('fs');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
var usuarios = []; // Lista de usuários
var ultimas_mensagens = []; // Lista com ultimas mensagens enviadas no chat

//crio um servidor usando o node
var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(8087);

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {
  // convenience function to log server messages on the client
  //funcao para mandar uma mensagem do servidor p/ o cliente
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    //manda a mensagem para todos os clientes do servidor -> broadcasting
    socket.broadcast.emit('message', message);
  });

  //evento para criar sala que é solicitada pelo cliente
  //para o servidor .emit -> .on
  socket.on('create or join', function(room) {
    log('Received request to create or join room ' + room);

    //ele verifica quantos clientes existem na sala
    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    //manda a mensagem p/ o log informando isso
    log('Room ' + room + ' now has ' + numClients + ' client(s)');

    //agr ele analisa quando n tem cliente
    if (numClients === 0) {
      //faz o usuario entrar na sala
      socket.join(room);
      //cria um id pra ele e compartilha no log
      log('Client ID ' + socket.id + ' created room ' + room);
      //o servidor emite que a sala foi criada e o id do cliete
      socket.emit('created', room, socket.id);

      //caso a sala tenha um participante
      //entao ja existe sala
    } else if (numClients === 1) {
      //manda no log que o id do novo cliente
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      //add o cliente na sala
      socket.join(room);
      //emite que o cliente entrou na sala
      socket.emit('joined', room, socket.id);
      //fala que o cliente ja esta pronto pra conexao
      io.sockets.in(room).emit('ready');
    } else { // max two clients
      //caso ja tenha dois participantes
      //n entra na sala
      //so manda a msg que a sala ta cheia
      socket.emit('full', room);
    }
    
  });

  //DUVIDA
  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });

  socket.on('bye', function(){
    console.log('received bye');
  });

  ///////////chat socket////////////

  // Método de resposta ao evento de entrar
	socket.on("entrar", function(apelido, callback){
		if(!(apelido in usuarios)){
			socket.apelido = apelido;
      //apelido = socket.id;
			usuarios[socket.apelido] = socket; // Adicionadno o nome de usuário a lista armazenada no servidor

			// Enviar para o usuário ingressante as ultimas mensagens armazenadas.
			for(indice in ultimas_mensagens){
				socket.emit("atualizar mensagens", ultimas_mensagens[indice]);
			}

			var mensagem = "[ " + pegarDataAtual() + " ] " + apelido + " acabou de entrar na sala";
			var obj_mensagem = {msg: mensagem, tipo: 'sistema'};

			io.sockets.emit("atualizar usuarios", Object.keys(usuarios)); // Enviando a nova lista de usuários
			io.sockets.emit("atualizar mensagens", obj_mensagem); // Enviando mensagem anunciando entrada do novo usuário

			armazenaMensagem(obj_mensagem); // Guardando a mensagem na lista de histórico

			callback(true);
		}else{
			callback(false);
		}
	});

	socket.on("enviar mensagem", function(dados, callback){

		var mensagem_enviada = dados.msg;
		var usuario = dados.usu;
		if(usuario == null)
			usuario = ''; // Caso não tenha um usuário, a mensagem será enviada para todos da sala
    
      mensagem_enviada = "[ " + pegarDataAtual() + " ] " + socket.apelido + " diz: " + mensagem_enviada;
      var obj_mensagem = {msg: mensagem_enviada, tipo: ''};

			if(usuario == ''){
        io.sockets.emit("atualizar mensagens", obj_mensagem);
        armazenaMensagem(obj_mensagem); // Armazenando a mensagem
      }else{
        obj_mensagem.tipo = 'privada';
        socket.emit("atualizar mensagens", obj_mensagem); // Emitindo a mensagem para o usuário que a enviou
        usuarios[usuario].emit("atualizar mensagens", obj_mensagem); // Emitindo a mensagem para o usuário escolhido
      }
		
		callback();
	});

	socket.on("disconnect", function(){
		delete usuarios[socket.apelido];
		var mensagem = "[ " + pegarDataAtual() + " ] " + socket.apelido + " saiu da sala";
		var obj_mensagem = {msg: mensagem, tipo: 'sistema'};

		// junto de um aviso em mensagem para os participantes da sala
    io.sockets.emit("atualizar usuarios", Object.keys(usuarios));		
		io.sockets.emit("atualizar mensagens", obj_mensagem);

		armazenaMensagem(obj_mensagem);
	});

});

// Função para apresentar uma String com a data e hora em formato DD/MM/AAAA HH:MM:SS
function pegarDataAtual(){
	var dataAtual = new Date();
	var dia = (dataAtual.getDate()<10 ? '0' : '') + dataAtual.getDate();
	var mes = ((dataAtual.getMonth() + 1)<10 ? '0' : '') + (dataAtual.getMonth() + 1);
	var ano = dataAtual.getFullYear();
	var hora = (dataAtual.getHours()<10 ? '0' : '') + dataAtual.getHours();
	var minuto = (dataAtual.getMinutes()<10 ? '0' : '') + dataAtual.getMinutes();
	var segundo = (dataAtual.getSeconds()<10 ? '0' : '') + dataAtual.getSeconds();

	var dataFormatada = dia + "/" + mes + "/" + ano + " " + hora + ":" + minuto + ":" + segundo;
	return dataFormatada;
}

// Função para guardar as mensagens e seu tipo na variável de ultimas mensagens
function armazenaMensagem(mensagem){
	if(ultimas_mensagens.length > 5){
		ultimas_mensagens.shift();
	}

	ultimas_mensagens.push(mensagem);
}
