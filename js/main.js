var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;

var pcConfig = {
  'iceServers': [{
    'urls': 'stun:stun.l.google.com:19302'
  }]
};

// Set up audio and video regardless of what devices are present.
//pede para o navegador pra receber audio e video
var sdpConstraints = {
  offerToReceiveAudio: true,
  offerToReceiveVideo: true
};

/////////////////////////////////////////////

//crio o nome da sala
var room = 'foo';
// Could prompt for room name:
// room = prompt('Enter room name:');

//me conecta como o cliente local
var socket = io.connect();

//se nao existe sala
if (room !== '') {
  //manda o cliente p/ o create or join e analisa
  socket.emit('create or join', room);
  //exibe no log que foi criada uma tentativa de entrar ou criar uma sala
  console.log('Attempted to create or  join room', room);
}

//caso precise criar a sala
//é emitido o created
socket.on('created', function(room) {
  //manda a msg no log que a sala foi criada
  console.log('Created room ' + room);
  //variavel do tipo booleana
  //define ela como true quando a sla é criada
  isInitiator = true;
});

//caso a sala esteja cheia
//é emitido o full
socket.on('full', function(room) {
  //somente manda no log a mensagem que a sala ja ta cheia
  console.log('Room ' + room + ' is full');
});

//quando é emitido pro usuario entrar na sala
socket.on('join', function (room){
  //fala que foi requisitado a entrada na sala
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});
//qual a diferenca do join pro joined

//DUVIDA
socket.on('log', function(array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////

//uma funcao siples que retorna uma mensagem para o log e para o servidor
function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

//funcao que retorna quando o cliente recebe uma mensagem
socket.on('message', function(message) {
  console.log('Client received message:', message);
  //mensagens especificas//

  //caso seja got user media
  if (message === 'got user media') {
    //aciona a funcao maybeStart
    maybeStart();
  } 
  
  //caso seja offer
  else if (message.type === 'offer') {
    //DUVIDA
    if (!isInitiator && !isStarted) {
      //aciona a funcao maybeStart
      maybeStart();
    }
    //DUVIDA
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } 
  
  //ESSAS DUAS DUVIDAS SAO SOBRE O ICECANDIDATE E AS FUNCOES DO RTC
  //DUVIDA
  else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } 
  
  //DUVIDA
  else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } 
  
  //caso a mensagem seja bye e o isstarted esteja como true
  else if (message === 'bye' && isStarted) {
    //ativa essa funcao que serve basicamente pra deslogar
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

//defino a diferenca do meu video local e do meu cideo remoto
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

//defino minhas midias sem audio e com video(pra n retorna eco)
navigator.mediaDevices.getUserMedia({
  audio: false,
  video: true
})
//executo a funcao gotStream
.then(gotStream)
//caso n funciona me retorna a msg de erro
.catch(function(e) {
  alert('getUserMedia() error: ' + e.name);
});

//manda uma msg no log que ta adicionando midia
//defino meus videos como local
//mando a msg que to usando minhas midias
function gotStream(stream) {
  console.log('Adding local stream.');
  localStream = stream;
  localVideo.srcObject = stream;
  sendMessage('got user media');
  //caso seja o iniciador executa a funcao maybestart
  if (isInitiator) {
    maybeStart();
  }
}

var constraints = {
  video: true
};
//falo que meu video ta ligado
console.log('Getting user media with constraints', constraints);

//coisa sobre ice candidate
if (location.hostname !== 'localhost') {
  requestTurn(
    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  );
}

//prineiro mando uma msg para o console falando das minhas variaveis
function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  //isstarted -> false/n tenha localstream ainda e o canal esteja pronto
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    //msg para o log
    console.log('>>>>>> creating peer connection');
    //executa a funcao
    createPeerConnection();
    //falo pra executar meu fluxo de video
    pc.addStream(localStream);
    //defino que ja comecou, portanto n executa td isso de novo
    isStarted = true;
    //mando pro console log que sou o inicializador da chamada
    console.log('isInitiator', isInitiator);
    //faco a chamada
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

/////////////////////////////////////////////////////////
//funcao para comecar a conexao
//executo tudo e mando msg caso tenha erro
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

//funcao para descobrir meu candidato ice
function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

//funcao para sair da call
function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

//retorna uma msg de termino da sessao no log
//executa a funcao stop
//deixa a variavel isInitiator como false
function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}
