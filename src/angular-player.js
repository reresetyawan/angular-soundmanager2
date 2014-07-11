angular.module('angularSoundManager', [])

    .filter('humanTime', function () {
        return function (input) {
            function pad(d) {
                return (d < 10) ? '0' + d.toString() : d.toString();
            }

            var min = (input / 1000 / 60) << 0,
                sec = Math.round((input / 1000) % 60);

            return pad(min) + ':' + pad(sec);
        };
    })

    .factory('player', [ '$rootScope', function ($rootScope) {

        var currentTrack = null,
            repeat = false,
            autoPlay = true,
            volume = 90,
            trackProgress = 0,
            playlist = [];

        return {
            init: function () {

                if (typeof soundManager === 'undefined') {
                    alert('Please include SoundManager2 Library!');
                }

                soundManager.setup({
                    //url: '/path/to/swfs/',
                    //flashVersion: 9,
                    preferFlash: false, // prefer 100% HTML5 mode, where both supported
                    debugMode: false, // enable debugging output (console.log() with HTML fallback)
                    useHTML5Audio: true,
                    onready: function () {
                        //console.log('sound manager ready!');
                    },
                    ontimeout: function () {
                        alert('SM2 failed to start. Flash missing, blocked or security error?');
                        alert('The status is ' + status.success + ', the error type is ' + status.error.type);
                    },
                    defaultOptions: {
                        // set global default volume for all sound objects
                        autoLoad: false, // enable automatic loading (otherwise .load() will call with .play())
                        autoPlay: false, // enable playing of file ASAP (much faster if "stream" is true)
                        from: null, // position to start playback within a sound (msec), see demo
                        loops: 1, // number of times to play the sound. Related: looping (API demo)
                        multiShot: false, // let sounds "restart" or "chorus" when played multiple times..
                        multiShotEvents: false, // allow events (onfinish()) to fire for each shot, if supported.
                        onid3: null, // callback function for "ID3 data is added/available"
                        onload: null, // callback function for "load finished"
                        onstop: null, // callback for "user stop"
                        onpause: null, // callback for "pause"
                        onplay: null, // callback for "play" start
                        onresume: null, // callback for "resume" (pause toggle)
                        position: null, // offset (milliseconds) to seek to within downloaded sound.
                        pan: 0, // "pan" settings, left-to-right, -100 to 100
                        stream: true, // allows playing before entire file has loaded (recommended)
                        to: null, // position to end playback within a sound (msec), see demo
                        type: null, // MIME-like hint for canPlay() tests, eg. 'audio/mp3'
                        usePolicyFile: false, // enable crossdomain.xml request for remote domains (for ID3/waveform access)
                        volume: volume, // self-explanatory. 0-100, the latter being the max.
                        whileloading: function () {
                            //soundManager._writeDebug('sound '+this.id+' loading, '+this.bytesLoaded+' of '+this.bytesTotal);
                        },
                        whileplaying: function () {
                            //soundManager._writeDebug('sound '+this.id+' playing, '+this.position+' of '+this.duration);

                            //broadcast current playing track id
                            currentTrack = this.id;
                            //$rootScope.$broadcast('track:id', this.id);

                            //broadcast current playing track progress
                            trackProgress = ((this.position / this.duration) * 100);
                            $rootScope.$broadcast('track:progress', trackProgress);

                            //broadcast track position
                            $rootScope.$broadcast('currentTrack:position', this.position);

                            //broadcast track duration
                            $rootScope.$broadcast('currentTrack:duration', this.duration);
                        },
                        onfinish: function () {
                            soundManager._writeDebug(this.id + ' finished playing');
                            if (autoPlay === true) {
                                //play next track if autoplay is on
                                //get your angular element
                                var elem = angular.element(document.querySelector('[ng-controller]'));
                                //get the injector.
                                var injector = elem.injector();
                                //get the service.
                                var player = injector.get('player');
                                player.nextTrack();

                                $rootScope.$broadcast('track:id', currentTrack);
                            }
                        }
                    }
                });
                soundManager.onready(function () {
                    console.log('song manager ready!');
                    // Ready to use; soundManager.createSound() etc. can now be called.
                    var isSupported = soundManager.ok();
                    console.log(isSupported);
                });
            },
            isInArray: function (array, value) {
                for (var i = 0; i < array.length; i++) {
                    if (array[i].id === value) {
                        return i;
                    }
                }

                return false;
            },
            getIndexByValue: function (array, value) {
                for (var i = 0; i < array.length; i++) {
                    if (array[i] === value) {
                        return i;
                    }
                }

                return false;
            },
            asyncLoop: function (o) {
                var i = -1;

                var loop = function () {
                    i++;
                    if (i == o.length) {
                        o.callback();
                        return;
                    }
                    o.functionToLoop(loop, i);
                }
                loop();//init
            },
            setCurrentTrack: function (key) {
                currentTrack = key;
            },
            getCurrentTrack: function () {
                return currentTrack;
            },
            currentTrackData: function () {
                var trackId = this.getCurrentTrack();
                var currentKey = this.isInArray(playlist, trackId);
                return playlist[currentKey];
            },
            getPlaylist: function (key) {
                if (typeof key === 'undefined') {
                    return playlist;
                } else {
                    return playlist[key];
                }
            },
            addToPlaylist: function (track) {
                return playlist.push(track);
            },
            addSong: function (song) {
                //check if url is playable
                if (soundManager.canPlayURL(song.url) !== true) {
                    console.log('invalid song url');
                    return;
                }

                //check if song already exists
                var inArrayKey = this.isInArray(this.getPlaylist(), song.id);
                if (inArrayKey !== false) {
                    console.log('song already exists in playlist');

                    if (autoPlay === true) {
                        this.setCurrentTrack(inArrayKey);
                    }

                    return this.getPlaylist(inArrayKey).id;
                }

                //add to sound manager
                soundManager.createSound({
                    id: song.id,
                    url: song.url
                });

                //add to playlist
                this.addToPlaylist({
                    id: song.id,
                    title: song.title
                });

                return song.id;
            },
            removeSong: function (song, index) {
                //unload from soundManager
                soundManager.destroySound(song);

                //remove from playlist
                playlist.splice(index, 1);
            },
            play: function () {
                if (this.getCurrentTrack() === null) {
                    if (soundManager.soundIDs.length === 0) {
                        console.log('playlist is empty!');
                        return;
                    }

                    var firstTrack = soundManager.soundIDs[0];
                    soundManager.play(firstTrack);
                    this.setCurrentTrack(firstTrack);
                } else {
                    soundManager.play(this.getCurrentTrack());
                }

                $rootScope.$broadcast('track:id', currentTrack);
            },
            pause: function () {
                soundManager.pause(this.getCurrentTrack());
            },
            stop: function () {
                this.resetProgress();
                $rootScope.$broadcast('track:progress', trackProgress);
                soundManager.stopAll();
                soundManager.unload(this.getCurrentTrack());
            },
            playTrack: function (trackId) {
                //stop and unload currently playing track
                this.stop();
                //set new track as current track
                this.setCurrentTrack(trackId);
                //play it
                soundManager.play(trackId);

                $rootScope.$broadcast('track:id', trackId);
            },
            nextTrack: function () {
                var currentTrackKey = this.getIndexByValue(soundManager.soundIDs, this.getCurrentTrack());
                var nextTrackKey = +currentTrackKey + 1;
                var nextTrack = soundManager.soundIDs[nextTrackKey];

                if (typeof nextTrack !== 'undefined') {
                    this.playTrack(nextTrack);
                } else {
                    //if no next track found
                    if (repeat === true) {
                        //start first track if repeat is on
                        this.playTrack(soundManager.soundIDs[0]);
                    }
                }
            },
            prevTrack: function () {
                var currentTrackKey = this.getIndexByValue(soundManager.soundIDs, this.getCurrentTrack());
                var prevTrackKey = +currentTrackKey - 1;
                var prevTrack = soundManager.soundIDs[prevTrackKey];

                if (typeof prevTrack !== 'undefined') {
                    this.playTrack(prevTrack);
                } else {
                    console.log('no prev track found!');
                }
            },
            mute: function () {
                if (soundManager.muted === true) {
                    soundManager.unmute()
                } else {
                    soundManager.mute();
                }

                $rootScope.$broadcast('music:mute', soundManager.muted);
            },
            getMuteStatus: function () {
                return soundManager.muted;
            },
            repeatToggle: function () {
                if (repeat === true) {
                    repeat = false;
                } else {
                    repeat = true;
                }

                $rootScope.$broadcast('music:repeat', repeat);
            },
            getRepeatStatus: function () {
                return repeat;
            },
            getVolume: function () {
                return volume;
            },
            adjustVolume: function (increase) {
                var changeVolume = function (volume) {
                    for (var i = 0; i < soundManager.soundIDs.length; i++) {
                        var mySound = soundManager.getSoundById(soundManager.soundIDs[i]);
                        mySound.setVolume(volume);
                    }

                    $rootScope.$broadcast('music:volume', volume);
                };

                if (increase === true) {
                    if (volume < 100) {
                        volume = volume + 10;
                        changeVolume(volume);
                    }
                } else {
                    if (volume > 0) {
                        volume = volume - 10;
                        changeVolume(volume);
                    }
                }
            },
            clearPlaylist: function (callback) {
                console.log('clear playlist');
                this.resetProgress();

                //unload and destroy soundmanager sounds
                var smIdsLength = soundManager.soundIDs.length;
                this.asyncLoop({
                    length: smIdsLength,
                    functionToLoop: function (loop, i) {
                        setTimeout(function () {
                            //custom code
                            soundManager.destroySound(soundManager.soundIDs[0]);
                            //custom code
                            loop();
                        }, 100);
                    },
                    callback: function () {
                        //callback custom code
                        console.log('All done!');
                        //clear playlist
                        playlist = [];
                        $rootScope.$broadcast('music:playlist', playlist);

                        callback(true);
                        //callback custom code
                    }
                });

            },
            resetProgress: function () {
                trackProgress = 0;
            }
        };
    }])

    .directive('soundManager', ['$filter', 'player', function ($filter, player) {
        return {
            restrict: "E",
            link: function (scope, element, attrs) {

                //init and load sound manager 2
                player.init();

                scope.$on('track:progress', function (event, data) {
                    scope.$apply(function () {
                        scope.progress = data;
                    });
                });

                scope.$on('track:id', function (event, data) {
                    scope.$apply(function () {
                        scope.currentPlaying = player.currentTrackData();
                    });
                });

                scope.$on('currentTrack:position', function (event, data) {
                    scope.$apply(function () {
                        scope.currentPostion = $filter('humanTime')(data);
                    });
                });

                scope.$on('currentTrack:duration', function (event, data) {
                    scope.$apply(function () {
                        scope.currentDuration = $filter('humanTime')(data);
                    });
                });

            }
        };
    }])
    .directive('musicPlayer', ['player', function (player) {
        return {
            restrict: "EA",
            scope: {
                songs: "=allSongs",
                playlist: "=myPlaylist"
            },
            link: function (scope, element, attrs) {

                var trackId = null;

                var addToPlaylist = function () {
                    trackId = player.addSong(scope.songs[attrs.song]);

                    scope.$apply(function () {
                        scope.playlist = player.getPlaylist();
                    });
                };

                element.bind('click', function () {

                    if (attrs.type === 'addToPlaylist') {
                        console.log('adding song to playlist');

                        addToPlaylist();

                    } else if (attrs.type === 'playTrack') {
                        console.log('play track');

                        addToPlaylist();

                        player.playTrack(trackId);
                    }

                });
            }
        };
    }])
    .directive('playFromPlaylist', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    console.log(attrs.song);
                    player.playTrack(attrs.song);
                });

            }
        };
    }])
    .directive('removeFromPlaylist', ['player', function (player) {
        return {
            restrict: "EA",
            scope: {
                playlist: "=myPlaylist"
            },
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    player.removeSong(attrs.song, attrs.index);
                    //refresh playlist
                    scope.$apply(function () {
                        scope.playlist = player.getPlaylist();
                    });
                });

            }
        };
    }])
    .directive('seekTrack', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    if (player.getCurrentTrack() === null) {
                        console.log('no track loaded');
                        return;
                    }

                    var sound = soundManager.getSoundById(player.getCurrentTrack());

                    var x = event.x - element[0].offsetLeft,
                        width = element[0].clientWidth,
                        duration = sound.durationEstimate;

                    sound.setPosition((x / width) * duration);
                });

            }
        };
    }])
    .directive('playMusic', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    player.play();
                });

            }
        };
    }])
    .directive('pauseMusic', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    player.pause();
                });

            }
        };
    }])
    .directive('stopMusic', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    player.stop();
                });

            }
        };
    }])
    .directive('nextTrack', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    player.nextTrack();
                });

            }
        };
    }])
    .directive('prevTrack', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    player.prevTrack();
                });

            }
        };
    }])
    .directive('muteMusic', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    player.mute();
                });

                scope.mute = player.getMuteStatus();
                scope.$on('music:mute', function (event, data) {
                    scope.$apply(function () {
                        scope.mute = data;
                    });
                });

            }
        };
    }])
    .directive('repeatMusic', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    player.repeatToggle();
                });

                scope.repeat = player.getRepeatStatus();
                scope.$on('music:repeat', function (event, data) {
                    scope.$apply(function () {
                        scope.repeat = data;
                    });
                });
            }
        };
    }])
    .directive('musicVolume', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    if (attrs.type === 'increase') {
                        player.adjustVolume(true);
                    } else {
                        player.adjustVolume(false);
                    }
                });

                scope.volume = player.getVolume();
                scope.$on('music:volume', function (event, data) {
                    scope.$apply(function () {
                        scope.volume = data;
                    });
                });

            }
        };
    }])
    .directive('setPlaylist', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                scope.playlist = player.getPlaylist();
                scope.$on('music:playlist', function (event, data) {
                    scope.$apply(function () {
                        scope.playlist = player.getPlaylist();
                    });
                });

            }
        };
    }])
    .directive('clearPlaylist', ['player', function (player) {
        return {
            restrict: "EA",
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {
                    console.log(soundManager.soundIDs);
                    player.clearPlaylist(function (data) {
                        console.log(soundManager.soundIDs);
                    });
                });

            }
        };
    }])
    .directive('playAll', ['player', function (player) {
        return {
            restrict: "EA",
            scope: {
                songs: '=playAll',
                playlist: "=myPlaylist"
            },
            link: function (scope, element, attrs) {

                element.bind('click', function (event) {

                    //first clear the playlist
                    player.clearPlaylist(function (data) {
                        console.log('cleared, ok now add to playlist');
                        //add songs to playlist
                        for (var i = 0; i < scope.songs.length; i++) {

                            player.addSong(scope.songs[i]);
                        }


                        scope.$apply(function () {
                            scope.playlist = player.getPlaylist();
                        });

                        //play first song
                        player.play();
                    });

                });

            }
        };
    }]);
