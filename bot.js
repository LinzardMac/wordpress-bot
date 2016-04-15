// Includes
var config = require( './config' );
var irc = require( 'irc' );
var nickserv = require( 'nickserv' );
var google = require( 'google' );
var request = require( 'request' );
var cheerio = require( 'cheerio' );
var moment = require( 'moment-timezone' );

// Initialize
google.resultsPerPage = 1;
var tell = [];
var seen = [];
var flood = [];

// Create the bot
var bot = new irc.Client( config.server, config.name, {
	// channels: config.channels,
	realName: '##wordpress IRC Bot',
	autoRejoin: true
});

// Use nickserv to handle communication between
var ns = new nickserv( config.name, {
	password: config.pass,
	email: config.email
});
ns.attach( 'irc', bot );

// Connected events
bot.addListener( 'registered', function ( message ) {
	ns.identify( config.pass, function( err ) {
		if ( err && config.debug ) console.log( 'nickserv error:' + err );
		config.channels.forEach( function( value, index, array ) {
			bot.join( value + ' ' + config.pass );
			bot.send( '/msg chanserv op ' + value + ' ' + config.name );
		});
	});
});

// Error handler
bot.addListener( 'error', function ( message ) {
	console.error( 'ERROR: ');
	console.error( message );
});

// Join events
bot.addListener( 'join', function( channel, who ) {
	if ( config.debug ) console.log( who + ' joined ' + channel );
	// When other users join the channel (not the bot)
	if ( bot.nick != who ) {
		// Check for pending .tell commands for this user
		var told = [];
		tell.forEach( function( value, index, array ) {
			if ( value.from == who ) {
				if ( config.debug ) console.log( 'Delivering .tell message to ' + who );
				bot.say( who, 'Message from ' + value.from + ': ' + value.message );
				told.push( index );
			}
		});

		// Remove the messages that have been delivered
		if ( told.length ) {
			told.forEach( function( value, index, array ) {
				tell.splice( value, 1 );
			});
		}
	} else {
		// Actions to perform when the bot joins the channel
	}
});

// Part events
bot.addListener( 'part', function( channel, who ) {
	if ( config.debug ) {
		console.log( 'Part Handler!!' );
		console.log( channel );
	}
	// Add parting user to the seen array
	seen.push({
		event: 'part',
		nick: who,
		channel: channel,
		time: moment().tz( 'America/New_York' ).format( 'MMMM Do YYYY, h:mm:ss a z' )
	});
});

// Quit events
bot.addListener( 'quit', function( nick, reason, channels, message ) {
	if ( config.debug ) console.log( message );
	// Add parting user to the seen array
	seen.push({
		event: 'quit',
		nick: nick,
		channel: channels,
		reason: reason,
		message: message,
		time: moment().tz( 'America/New_York' ).format( 'MMMM Do YYYY, h:mm:ss a z' )
	});
});

// Nick change events
bot.addListener( 'nick', function ( oldnick, newnick, channels, message ) {
	// Update seen array if necessary
	seen.push({
		event: 'nick',
		nick: oldnick,
		newnick: newnick,
		channel: channels,
		message: message,
		time: moment().tz( 'America/New_York' ).format( 'MMMM Do YYYY, h:mm:ss a z' )
	});
});

// Message events
bot.addListener( 'message', function( from, to, text, message ) {
	if ( config.muted.indexOf( message.args[0] ) > -1 ) {
		return;
	}
	// Debug incoming messages
	if ( config.debug ) {
		console.log( '============ From ============' );
		console.log( from );
		console.log( '============  To  ============' );
		console.log( to );
		console.log( '============ Text ============' );
		console.log( text );
		console.log( '============ MESG ============' );
		console.log( message );
		console.log( '==============================' );
	}

	// Check messages
	if ( to == bot.nick ) {
		// Private message handler
		if ( config.debug ) console.log( 'Private Message Handler!!' );
		bot.say( from, 'Hey ' + from + '... I\'m a bot and I\'m not currently programmed to handle your private messages. Check back soon.' );
	} else {
		// Public message handler
		// floodCheck( message );
		var command = text.match( /.(\w+)/ );
		if ( config.debug ) console.log( 'Public Message Handler!!' );
		if ( config.debug ) console.log( command );

		if ( command && command.length && command[0].charAt(0) == '.' ) {
			// Initialize
			var cmd = command[1];
			var str = command.input.replace( command[0] + ' ', '' );
			var who = str.split( '> ' );
			if ( who.length == 1 ) {
				who = false;
			} else {
				who = who.pop();
				str = str.replace( ' > ' + who, '' );
			}

			// Debug
			if ( config.debug ) {
				console.log( 'cmd: ' + cmd );
				console.log( 'str: ' + str );
				console.log( 'who: ' + who );
			}

			// Process command
			switch ( cmd ) {
				// Help
				case 'help':
					var commands = [ '.g', '.c', '.p', '.seen', '.tell', '.first', '.paste', '.hierarchy', '._', '.blame', '.ask', '.say' ];
					var helpstr = 'Available Commands: ' + commands.join( ', ' );
					bot.say( who ? who : from, helpstr );
					console.log( 'sending help message to: ' + who ? who : from );
					break;

				// Google Search
				case 'g':
					if ( config.debug ) console.log( '[Google Search] for: ' + str );
					google( str, function ( err, next, links ) {
						if ( err && config.debug ) console.error( err );
						// Show the search results
						bot.say( to, who ? who + ': ' + links[0].link : from + ': ' + links[0].link );
					});
					break;

				// Codex Search
				case 'c':
					if ( config.debug ) console.log( '[Codex Search] for: ' + str );
					google( str + ' site:wordpress.org', function ( err, next, links ) {
						if ( err && config.debug ) console.error( err );
						// Show the search results
						bot.say( to, who ? who + ': ' + links[0].link : from + ': ' + links[0].link );
					});
					break;

				// YouTube Search
				case 'y':
					if ( config.debug ) console.log( '[YouTube Search] for: ' + str );
					google( str + ' site:youtube.com', function ( err, next, links ) {
						if ( err && config.debug ) console.error( err );
						if ( config.debug ) console.log( links );
						// Show the search results
						if ( links[0].link ) bot.say( to, who ? who + ': ' + links[0].link : from + ': ' + links[0].link );
					});
					break;

				// Plugin Search
				case 'p':
					if ( config.debug ) console.log( '[Plugin Search] for: ' + str );
					google( str + ' site:https://wordpress.org/plugins', function ( err, next, links ) {
						if ( err && config.debug ) console.error( err );
						if ( config.debug ) console.log( links );
						// Show the search results
						if ( links.length ) {
							bot.say( to, who ? who + ': ' + links[0].link : from + ': ' + links[0].link );
						}
					});
					break;

				// Seen command
				case 'seen':
					if ( from != str ) {
						var none = true;
						if ( config.debug ) {
							console.log( '[Seen Search] for: ' + str );
							console.log( bot.chans );
							console.log( 'Search through:' );
							console.log( config.channels );
						}
						// Check channels first
						config.channels.forEach( function( pvalue, pindex, parray ) {
							// Normalize the case of each user for case insensitive checking
							var chanusers = [];
							for ( var user in bot.chans[ pvalue ].users ) {
								chanusers.push( user.toLowerCase() );
							}

							// Loop through case normalized usernames
							for ( var user in bot.chans[ pvalue ].users ) {
								if ( none && bot.chans[ pvalue ].users.hasOwnProperty( str ) ) {
									bot.say( to, who ? who + ': ' + str + ' is currently in ' + pvalue : from + ': ' + str + ' is currently in ' + pvalue );
									none = false;
								}
							}
						});
						// Search through seen array
						seen.forEach( function( value, index, array ) {
							if ( value.nick == str ) {
								// Setup the seen message
								var msg = 'Last seen ' + value.nick + ' ';
								var time = ' on ' + value.time;
								switch ( value.event ) {
									case 'nick':
										msg += 'changing their nick to ' + value.newnick + time;
										break;
									case 'part':
										msg += 'parting ' + value.channel + time;
										if ( value.message ) msg += ' with the message: ' + value.message;
										break;
									case 'quit':
										msg += 'quitting IRC with the message: "' + value.reason + '"' + time;
										break;
								}
								bot.say( to, msg );
								none = false;
							}
						});
						if ( none ) bot.say( to, who ? who + ': ' + 'I haven\'t seen ' + str : from + ': ' + 'I haven\'t seen ' + str );
					} else {
						bot.say( to, 'That\'s hilarious ' + from + '...' );
					}
					break;

				// Tell command
				case 'tell':
					if ( who ) {
						// Add .tell message to the tell array
						if ( config.debug ) console.log( '[Tell ' + who + '] ' + str  );
						if ( tell.length ) {
							var already = false;
							tell.forEach( function( value, index, array ) {
								if ( value.from == from && value.message == str ) {
									already = true;
								}
							});
							if ( ! already ) {
								tell.push({ from: from, message: str });
								bot.say( message.args[0], from + ': I\'ll deliver your message to ' + who + ' the next time they join.' );
							}
						} else {
							tell.push({ from: from, message: str });
							bot.say( message.args[0], from + ': I\'ll deliver your message to ' + who + ' the next time they join.' );
						}
					}
					break;

				// Count command
				case 'count':
					if ( config.debug ) console.log( '[WordPress Count]' );
					request( 'https://wordpress.org/download/counter/?ajaxupdate=1', function( error, response, body ) {
						if ( ! error) {
							var msg = 'WordPress has been downloaded ' + body + ' times.';
							bot.say( message.args[0], who ? who + ': ' + msg : from + ': ' + msg );							
						}
					});
					break;

				// First command
				case 'first':
					var msg = 'Please attempt to disable all plugins, and use one of the default (Twenty*) themes. If the problem goes away, enable them one by one to identify the source of your troubles.';
					bot.say( message.args[0], who ? who + ': ' + msg : from + ': ' + msg );
					break;

				// Moving command
				case 'moving':
				case 'move':
					var msg = 'If you rename the WordPress directory on your server, switch ports or change the hostname http://codex.wordpress.org/Moving_WordPress applies';
					bot.say( message.args[0], who ? who + ': ' + msg : from + ': ' + msg );
					break;

				// Inspect command
				case 'inspect':
					var msg = 'Please use the built-in Developer Tools of your browser to fix problems with your website. Right click your page and pick Inspect Element (Cr, FF, Op) or press F12-button (IE) to track down CSS problems. Use the console to see JavaScript bugs.';
					bot.say( message.args[0], who ? who + ': ' + msg : from + ': ' + msg );
					break;

				// Paste command
				case 'paste':
					var msg = 'Please use http://wpbin.io to paste your multi-line code samples';
					bot.say( message.args[0], who ? who + ': ' + msg : from + ': ' + msg );
					break;

				// Hierarchy command
				case 'hierarchy':
					var msg = 'Please refer to the WordPress template hierarchy https://developer.wordpress.org/themes/basics/template-hierarchy/';
					bot.say( message.args[0], who ? who + ': ' + msg : from + ': ' + msg );
					break;

				// Underscores command
				case '_':
					var msg = 'Check out the Underscores base theme http://underscores.me';
					bot.say( message.args[0], who ? who + ': ' + msg : from + ': ' + msg );
					break;

				// 8ball
				case '8ball':
					var answers = [ 'Nope', 'Fat chance', 'Most definitely!', 'Yep', 'Try again later', 'How the hell am I supposed to know?', 'Most likely', 'Indeed', 'Not in this lifetime', 'Pffft... what do you think?' ];
					var answer = answers[ Math.floor( Math.random() * answers.length ) ];
					var msg = who ? who + ': ' + answer : from + ': ' + answer;
					bot.say( message.args[0], msg );
					break;

				// Blame command
				case 'blame':
					var msg = who ? who + ': ' + 'It\'s all ' + str + '\'s fault!' : 'It\'s all ' + str + '\'s fault!';
					bot.say( message.args[0], msg );
					break;

				// Flip command
				case 'flip':
					var prefix = who ? who + ': ' : '';
					if ( str == '.flip!' ) {
						var msg = prefix + '┻━┻︵  \\(°□°)/ ︵ ┻━┻';
					} else {
						var msg = prefix + '(╯°□°）╯︵ ┻━┻';
					}
					bot.say( message.args[0], msg );
					break;

				// Shrug command
				case 'shrug':
					var prefix = who ? who + ': ' : '';
					var msg = prefix + '¯\\_(ツ)_/¯';
					bot.say( message.args[0], msg );
					break;

				// Cry command
				case 'cry':
					var prefix = who ? who + ': ' : '';
					var msg = prefix + '(╯︵╰,)';
					bot.say( message.args[0], msg );
					break;

				// YOLO command
				case 'yolo':
					var prefix = who ? who + ': ' : '';
					var msg = prefix + 'Yᵒᵘ Oᶰˡʸ Lᶤᵛᵉ Oᶰᶜᵉ';
					bot.say( message.args[0], msg );
					break;

				// Party command
				case 'dance':
				case 'party':
				case 'boogie':
					var prefix = who ? who + ': ' : '';
					var msg = prefix + '┏(-_-)┛┗(-_-﻿)┓┗(-_-)┛┏(-_-)┓';
					bot.say( message.args[0], msg );
					break;

				// Finger command
				case 'finger':
					var prefix = who ? who + ': ' : '';
					var msg = prefix + '╭∩╮(ಠ_ಠ)╭∩╮';
					bot.say( message.args[0], msg );
					break;

				// Ask command
				case 'ask':
					var msg = 'Go ahead and ask your question. Asking to ask just takes extra time ;)';
					bot.say( message.args[0], who ? who + ': ' + msg : from + ': ' + msg );
					break;

				// Just a say command
				case 'say':
					bot.say( message.args[0], who ? who + ': ' + str : str );
					break;
			}
		}
	}
});

// Flood protection function (under construction)
function floodCheck( msg ) {
	if ( Array.isArray( flood ) && Array.isArray( flood[ msg.nick ] ) ) {
		var msgs = flood[ msg.nick ];
		// console.log( 'CHECKING EXISTING FLOOD ITEMS' );
		// if ( msgs.length + 1 == config.floodMessages ) {
		// 	// Kick the user or something and clear the array
		// } else {
		// 	// Make an array of times for testing against duration
		// 	var times = [];
		// 	msgs.forEach( function( value, index, array ) {
		// 		times.push( value.time );
		// 	});

		// 	console.log( times );
		// }
	} else {
		// console.log( 'ADDING NEW FLOOD ITEM' );
		flood[ msg.nick ] = [];
		flood[ msg.nick ].push({ time: moment(), nick: msg.nick, user: msg.user, host: msg.host, args: msg.args });
	}
	if ( config.debug ) {
		// console.log( '==============================' );
		// console.log( flood );
	}
}
