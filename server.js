var express = require('express');
var app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    ent = require('ent');

app.get('/', function(req,res){
   res.sendfile(__dirname+'/index.html');
});
var cards = {};
cards['attack_cards'] = {};
cards['deffense_cards'] = {};
cards['attack_cards']['sword'] =  {'name' : "sword", 'attack':25,'speed':2,'reach':4,'cd':0};
cards['attack_cards']['dagger'] = {'name':'dagger','attack':15,'speed':4,'reach':2,'cd':0};
cards['attack_cards']['spell'] = {'name':'spell','attack':30,'speed':1,'reach':6,'cd':0};
cards['deffense_cards']['leather'] = {'name':'leather','deffense':3,'magical_def':1,'stamina':3, 'cd':0};
cards['deffense_cards']['plate'] = {'name':'plate','deffense':4,'magical_def':1,'stamina':4,'cd':0};
cards['deffense_cards']['silk'] = {'name':'silk','deffense':1,'magical_def':4,'stamina':2,'cd':0};

var player = {};
player.stamina = 5;
player.reach = 2;
player.speed = 2;
player.attack = 2;
player.cards = [];

var player_registry = {};
var player_socketId = {};
var nbPlayer = 1;
var fightArea = {}
io.on('connection', function(socket){
    socket.on('nouveau_client',function(pseudo){
        if(pseudo == ""){
            pseudo = getRandomPseudo();
        }else{
            pseudo = ent.encode(pseudo.replace("/[^0-9a-zA-Z-\/_]/",''));
        }
        socket.user = {pseudo:pseudo,hp:100,stamina:5,reach:2,speed:2,attack:2,cards:[],canplay:false};
       player_registry[pseudo] = socket.user;
       player_socketId[pseudo] = socket.id;
       socket.emit('nouveau_client',{user:player_registry[socket.user.pseudo],nbPlayer:nbPlayer});
    });
    // socket.on('disconnect', function(){
    //     delete player_registry[socket.user.pseudo];
    //     console.log(player_registry);
    // });
    socket.on('player_card_choosen', function(cardsPlayer){
       player_registry[socket.user.pseudo].cards.push(findAttackCard(cardsPlayer[0][0]));
       player_registry[socket.user.pseudo].cards.push(findAttackCard(cardsPlayer[0][1]));
       player_registry[socket.user.pseudo].cards.push(findDeffCard(cardsPlayer[1][0]));
       player_registry[socket.user.pseudo].cards.push(findDeffCard(cardsPlayer[1][1]));
       socket.emit('update_card',{user:player_registry[socket.user.pseudo]});


    });

    socket.on('askAllPlayers', function(){
        io.emit('getAllPlayers',{player_registry:player_registry});
    })

    socket.on('fight_player',function(data){
        var askingPlayer = player_registry[socket.user.pseudo];
        var askedPlayerSID = player_socketId[data];
        var message = player_registry[socket.user.pseudo].pseudo+" Has challanged you";
        io.to(askedPlayerSID).emit('fight_invitation',{message:message,challanging_player:player_registry[socket.user.pseudo].pseudo});
    })

    socket.on('fight_answer',function(data){
        player_registry[data.challanging_player].canplay = true;
        fightArea[1] = {playerOne:player_registry[data.challanging_player],playerTwo:player_registry[player_registry[socket.user.pseudo].pseudo],row:1}
        data = {message:'prepare to fight!',fightArea:fightArea[1]};
        emitToFightArea(fightArea[1],'fight_start',data);
    });
    socket.on('fightUpdate', function(data){
        if(data.fightArea.playerOne.canplay == true){
            var attacker = data.fightArea.playerOne;
            var deffenser = data.fightArea.playerTwo;
            var attackerIsPlayerOne = true;
        }else{
            var attacker = data.fightArea.playerTwo;
            var deffenser = data.fightArea.playerOne;
            var attackerIsPlayerOne = false;
        }
        attacker.cards.forEach(function(index,item){
            if(index.cd > 0){
                attacker.cards[item].cd -= 1;
            }
        });
       deffenser.cards.forEach(function(index,item){

            if(index.cd > 0){
                deffenser.cards[item].cd -= 1;
            }
        });

        var usedCard = attacker.cards[data.usedCardIndex];
        attacker.cards[data.usedCardIndex].cd = 2;
        attacker.canplay = false;
        deffenser.canplay = true;
        var defCard1 = cards['deffense_cards'][deffenser.cards[2].name];
        var defCard2 = cards['deffense_cards'][deffenser.cards[3].name];

        var deffenserTotalPhysicalDef = defCard1.deffense + defCard2.deffense;
        var deffenserTotalMagicalDef = defCard1.magical_def + defCard2.magical_def;

        if(usedCard.name == "spell"){
            var totalDamageDone = usedCard.attack * (deffenserTotalMagicalDef/10);
        }else{
            var totalDamageDone = usedCard.attack * (deffenserTotalPhysicalDef/10);
        }

        deffenser.hp = deffenser.hp - totalDamageDone;


        if(attackerIsPlayerOne == true){
            fightArea[1].playerOne = attacker;
            fightArea[1].playerTwo = deffenser;
        }else{
            fightArea[1].playerTwo = attacker;
            fightArea[1].playerOne = deffenser;
        }
        fightArea[1].row += 1;
        var log = "<h3 style='color:red'>"+attacker.pseudo+"</h3> used "+usedCard.name+" and deals "+totalDamageDone+" damages to <h3 style='color:blue'> "+deffenser.pseudo+"</h3>";
        if(deffenser.hp <= 0){
            var data = {fightArea:fightArea[1],log:log}
            emitToFightArea(fightArea[1],'fightUpdate',data);

            log = "<h3 style='color:red'>"+attacker.pseudo+"</h3> WIN";
            var data = {winner:attacker,fightArea:fightArea[1],log:log}
            emitToFightArea(fightArea[1],'fightEnd',data);


        }else{
            var data = {fightArea:fightArea[1],log:log}
            emitToFightArea(fightArea[1],'fightUpdate',data);
        }

    })
});


function emitToFightArea(fightArea,event,data){
    var playerOne = player_socketId[fightArea.playerOne.pseudo];
    var playerTwo = player_socketId[fightArea.playerTwo.pseudo];

    io.to(playerOne).emit(event,data);
    io.to(playerTwo).emit(event,data);

}

function findAttackCard(name){
    return cards['attack_cards'][name];
}
function findDeffCard(name){
    return cards['deffense_cards'][name];
}


if(typeof process.env.PORT !== 'undefined'){
    server.listen(process.env.PORT || 8080);
}else{
    server.listen(1337);
}