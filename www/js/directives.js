angular.module('breakpoint.directives', ['breakpoint.services', 'amliu.timeParser'])

.directive('navButtons', function() {
	return {
		templateUrl: 'directives/nav_buttons.html'
	}
})

// Youtube Directive, help from: http://blog.oxrud.com/posts/creating-youtube-directive/
.directive('youtube', function($window, $interval, parse, timeParser) {
  return {
    restrict: "E",

    scope: {
      videoid: "@", // Our video ID (not the yt one)
      player: "=", // iFrame YT player element

      isFullscreened: "=", // Video states
      isPaused: "=",

      duration: "=", // Duration of the YT video in seconds
      duration_formatted: "=", // Duration of video formatted

      currentBp: "=", // Current BP as an index in the BP array
      currentBp_start: "=", // Start time of the curent BP in seconds
      currentBp_start_formatted: "=", // Same time, formatted
      currentBp_end: "=", // End time of the current BP in seconds
      currentBp_end_formatted: "=", // End time of segment, formated

      currentTime: "=", // Current time in seconds
      currentTime_formatted: "=", // Current time that's been formated 00:00:00
      currentTime_intervalPromise: "=", // A promise used to clear the currentTime $interval watcher

      controlFadeTimeout: "=", // Used to set a timeout that fades out fullscreen controls

      draggingSlider: "=", // Set to true if the user is using the slider to skip around the video
      draggingMiniSlider: "=", // Set to true if the user is using the miniscrubber
      playMode: "=", // What does the player do when a breakpoint is hit?
      // "PM_PUSH" -> Keep going through BP
      // "PM_PAUSE" -> Pause when BP hit
      // "PM_REPEAT" -> Repeat segment when BP hit

      breakpoints: "=", // Array of Parse Breakpoint Objs
      api_timeoutId: "=" // ID of the timeout event that rechecks yt API load state
    },

    templateUrl: './directives/videoOverlay.html',

    link: function(scope, element) {

        // --------------------------------------------------
        // INITIALIZATION

        // We wrap the youtube initialization in an event listener because we don't know when parse
        // will get back to us and let us know videoId and youtubeID and also because we don't know when
        // the youtube API has loaded
        scope.$on('INIT', function(event, data) {
            console.log("Init");
            scope.playMode = "PM_PUSH";
            initPage(data);
        });
        function initPage(data) {
            if ((typeof(YT) !== "undefined") && (typeof(YT.Player) !== "undefined")) {
                resetPlayer(data);
                // UNCOMMENT THE NEXT TWO LINES IF WANT TO ENABLE ANNYANG
                // resetAnnyang();
                // annyang.start(); // Startup the listener
            } else { // Youtube API still not loaded, wait a second and try again
                console.log("TRY");
                scope.api_timeoutId = setTimeout(function() {initPage(data);}, 1000);
            }
        }

        // Loading in Sets and Breakpoints from controller
        scope.$on('LOAD_BPS', function(event, data) {
            console.log("Load BPS");
            scope.currentBp = 0;
            scope.breakpoints = data;
            resetCurrentBpStartEnd();
            positionBreakpoints();
        })

        // An event that is emitted when the videoshow page is 'popped' by pressing back
        scope.$on("LEAVE_VIDEOSHOW", function() {
            window.clearTimeout(scope.api_timeoutId); // Stop this timeout event
            scope.stopPlayer();
            // UNCOMMENT THE NEXT TWO LINES IF WANT TO ENABLE ANNYANG
            // annyang.removeCommands(); // Reset annyang so it doesn't use the old player
            // annyang.abort();
        })

        scope.$on("CHANGE_PLAYMODE", function(event, data) {
            scope.playMode = data;
            console.log(scope.playMode);
        })

        scope.$on('SKIP', function(event,time) { 
            playPlayer();
            scope.player.seekTo(time); 
        })

        scope.$on('VIDEO_NOT_FOUND', function(event, data) {
            videoNotFound();
        })

        // --------------------------------------------------
        // PLAYER EVENT LISTENERS

        scope.$on('PLAY', function() { playPlayer(); })
        scope.$on('PAUSE', function() { pausePlayer(); })
        scope.$on('STOP', function() { scope.stopPlayer(); })
        scope.$on('BACK', function() { scope.backPlayer(); })
        scope.$on('FORWARD', function() { scope.forwardPlayer(); })
        scope.$on('REPEAT', function() { scope.repeatPlayerSegment(); })

        scope.$on('FULLSCREEN', function() { scope.fullscreen(); })



        // --------------------------------------------------
        // VIDEO METHODS

        function resetAnnyang() {
            // Setup annyang words to listen for and methods to call for each
            var commands = {
                'play': scope.playPlayer,
                'stop' : scope.pausePlayer,
                'forward' : scope.forwardPlayer,
                'back' : scope.backPlayer,
                'repeat' : scope.repeatPlayerSegment
            };
            annyang.addCommands(commands); // Add our commands to annyang
        }

        function resetPlayer(data) {
            console.log("reset player");
            scope.player = new YT.Player(element.children()[0], {
                playerVars: {
                    autoplay: 0,
                    html5: 1,
                    theme: "light",
                    modestbranding: 1,
                    color: "white",
                    iv_load_policy: 3,
                    showinfo: 0,
                    controls: 0,
                    iv_load_policy: 3,
                    playsinline: 1
                },
                height: "100%",
                width: "100%",
                videoId: data,
                events: {
                    'onReady': onPlayerReady
                }
            });
        }
        function onPlayerReady() {
            console.log("Player Ready");
            scope.duration = scope.player.getDuration();
            scope.duration_formatted = timeParser.convertSeconds(scope.duration);
            scope.currentTime = scope.player.getCurrentTime();
            scope.currentTime_formatted = "00:00";

            scope.isFullscreened = false;
            scope.isPaused = true;
            hideLoading();

            document.querySelector("youtube[id='"+scope.videoid+"'] .bottom_player input").value = scope.currentTime;
            positionBreakpoints();
        }

        scope.stopPlayer = function() {
            scope.player.stopVideo();
            scope.isPaused = true;

            $interval.cancel(scope.currentTime_intervalPromise);
            scope.currentTime = scope.player.getCurrentTime();

            window.clearTimeout(scope.controlFadeTimeout);
            scope.fastShowControls();
        }

        scope.pausePlayPlayer = function($event) {
            if (scope.player.getPlayerState() !== 1) { // Paused, need to play
                playPlayer();
            } else { // Playing, need to pause
                pausePlayer();
            }
            event.stopPropagation();
        }

        function playPlayer() {
            $interval.cancel(scope.currentTime_intervalPromise);
            scope.currentTime_intervalPromise = $interval(refreshCurrentTime, 250);
            positionBreakpoints();
            scope.player.playVideo();
            scope.isPaused = false;

            scope.fadeOutControls();
        }

        function pausePlayer() {
            $interval.cancel(scope.currentTime_intervalPromise);
            scope.player.pauseVideo();
            scope.isPaused = true;

            window.clearTimeout(scope.controlFadeTimeout);
            scope.fastShowControls();
        }

        scope.forwardPlayer = function() {
            if (typeof scope.breakpoints != 'undefined') {
                findCurrent(scope.player.getCurrentTime());
                increaseCurrent(scope.player.getCurrentTime());

                scope.player.seekTo(scope.breakpoints[scope.currentBp].get("time"), true);
                refreshCurrentTime_watcher();
            }
        }

        scope.backPlayer = function() {
            if (typeof scope.breakpoints != 'undefined') {
                findCurrent(scope.player.getCurrentTime());
                decreaseCurrent(scope.player.getCurrentTime());

                scope.player.seekTo(scope.breakpoints[scope.currentBp].get("time"), true);
                refreshCurrentTime_watcher();
            }
        }

        scope.repeatPlayerSegment = function() {
            if (typeof scope.breakpoints != 'undefined') {
                var currentTime = scope.player.getCurrentTime();
                if (!currentIsSynced(currentTime)) {
                    // Player scrubbed or skipped sections, meaning our current pointer is no longer correct
                    findCurrent(currentTime);
                }

                scope.player.seekTo(scope.breakpoints[scope.currentBp].get("time"), true);
                refreshCurrentTime_watcher();
            }
        }

        // Rotating the screen for native
        document.addEventListener("deviceready", function() {
            scope.landscape = function() {
                screen.lockOrientation('landscape');
            }
            scope.portrait = function() {
                screen.lockOrientation('portrait');
            }
        }, false)

        scope.fullscreen = function() {
            scope.isFullscreened = true;
            // Parent of the youtube tag is the scroller container. We use ID to ensure we grab the currently viewed page
            angular.element(document.getElementById(scope.videoid).parentNode).addClass("no-scroll");

            angular.element(document.getElementsByTagName("ion-view")).removeClass("has-header");
            angular.element(document.querySelectorAll("ion-header-bar")).addClass("hide");
            angular.element(document.getElementsByTagName("ion-footer-bar")).addClass("hide");

            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).removeClass("hide");
            angular.element(document.querySelector("youtube[id='"+scope.videoid+"']")).addClass("fullscreen");

            // // By default, the fullscreen player controls are faded out from view, similar to the YT mobile app
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).removeClass("fadeOut");
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).addClass("fadedOut");

            scope.landscape();
            positionBreakpoints();
        }

        scope.leave_fullscreen = function() {
            scope.isFullscreened = false;

            angular.element(document.getElementById(scope.videoid).parentNode).removeClass("no-scroll");

            angular.element(document.getElementsByTagName("ion-view")).addClass("has-header");
            angular.element(document.querySelectorAll("ion-header-bar")).removeClass("hide");
            angular.element(document.getElementsByTagName("ion-footer-bar")).removeClass("hide");

            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).addClass("hide");
            angular.element(document.querySelector("youtube[id='"+scope.videoid+"']")).removeClass("fullscreen");

            scope.portrait();
            positionBreakpoints();
        }

        scope.showHide_BpBrowser = function($event) {
            if (angular.element(document.querySelector("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).hasClass("browsing")) {
                angular.element(document.querySelector("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).removeClass("browsing");

                // Fade out the controls if they aren't pressed on like before
                scope.controlFadeTimeout = window.setTimeout(scope.fadeOutControls, 2500);
            } else {
                angular.element(document.querySelector("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).addClass("browsing");
                document.querySelector("youtube[id='"+scope.videoid+"'] .chosen_bp").scrollIntoView();
                // TODO :: The scrollIntoView gets it visible, but doesn't attempt to center on it

                // Prevent fading out while the user browses
                window.clearTimeout(scope.controlFadeTimeout);
                scope.fastShowControls();
            }
            event.stopPropagation();
        }

        scope.jumpToBp = function(bpIndex, $event) {
            scope.currentBp = bpIndex;
            scope.player.seekTo(scope.breakpoints[scope.currentBp].get("time"), true);

            // We need to start the current time watcher just in case due to the skip
            refreshCurrentTime_watcher();
            scope.fadeOutControls();
            event.stopPropagation();
        }

        scope.getCurrentTime = function() {
            return scope.player.getCurrentTime();
        }

        // Starts up the interval event only if the player is currently not paused or stopped
        scope.setInterval_currentTime = function($event) {
            if (scope.player.getPlayerState() !== 0 && scope.player.getPlayerState() !== 2) {
                // Only restart the current time watcher if the player is not stopped (0) or paused (2)
                scope.currentTime_intervalPromise = $interval(refreshCurrentTime, 250);
            }
            event.stopPropagation();
        }

        // Used in any instance where we skip between breakpoints (forward, backward, repeat, browse)
        // Refreshes the current time interval and variables
        function refreshCurrentTime_watcher() {
            $interval.cancel(scope.currentTime_intervalPromise);
            scope.currentTime = scope.breakpoints[scope.currentBp].get("time");
            scope.currentTime_formatted = timeParser.convertSeconds(scope.currentTime);

            document.querySelector("youtube[id='"+scope.videoid+"'] .bottom_player input").value = scope.currentTime;
            scope.setInterval_currentTime();
        }

        // Starts the current time interval event watcher
        function refreshCurrentTime() {
            console.log("GOOGO");
            scope.currentTime = scope.player.getCurrentTime();
            console.log(scope.currentTime);
            scope.currentTime_formatted = timeParser.convertSeconds(scope.currentTime);
        }

        // We watch the current time and, whenever the next BP is passed, we reset the current BP
        scope.$watch("currentTime", function(newValue, oldValue) {
            if (!currentIsSynced(scope.currentTime)) {
                // If the current time is ever out of sync with the current BP, we've passed a BP
                if (scope.draggingSlider) {
                    // If we're currently messing with the slider, we don't want the video to pause and stuff
                    findCurrent(scope.currentTime);
                } else {
                    switch(scope.playMode) { // PLAYMODES!
                        case "PM_PUSH": // Just keep going past the breakpoint
                            findCurrent(scope.currentTime);
                            break;
                        case "PM_PAUSE": // Pause when a breakpoint is hit
                            findCurrent(scope.currentTime);
                            pausePlayer();
                            break;
                        case "PM_REPEAT": // Repeat the segment again
                            scope.player.seekTo(scope.breakpoints[scope.currentBp].get("time"), true);
                            break;
                    }
                }
            }
        })

        // Watch the current BP. When it changes, reset the dark purple "played segment" overlay
        // and reset the start and end points and DOM values of the miniscrubber
        // Also show the notification thing
        scope.$watch("currentBp", function(newValue, oldValue) {
            if (typeof scope.breakpoints != 'undefined') {
                positionPlayedSegments();
                resetCurrentBpStartEnd();
                document.querySelector("youtube[id='"+scope.videoid+"'] .yt_miniscrubber input").value = scope.currentTime;
                playNotification();
            }
        })

        // While dragging the mini scrubber we don't want the interface to... disappear lmao
        scope.$watch("draggingMiniSlider", function(newValue, oldValue, $event) {
            if (typeof scope.draggingMiniSlider != "undefined") {
                if (scope.draggingMiniSlider) {
                    window.clearTimeout(scope.controlFadeTimeout);
                    scope.fastShowControls();
                } else if (!scope.isPaused) {
                    scope.controlFadeTimeout = window.setTimeout(scope.fadeOutControls, 2500);
                }
                event.stopPropagation();
            }
        })

        // Used in the bottom player slider to get input from slider and set the video
        // to that location in seconds
        scope.setToSpot = function() {
            scope.player.seekTo(scope.currentTime, true);
        }

        scope.stopPropagation = function($event) {
            event.stopPropagation();
        }

        // --------------------------------------------------
        // METHODS

        function increaseCurrent(currentTime) {
            if (typeof scope.breakpoints != 'undefined') {
                if (currentTime < scope.breakpoints[0].get("time")) {
                    scope.currentBp = 0;
                } else {
                    scope.currentBp++;
                    scope.currentBp = scope.currentBp % scope.breakpoints.length;
                }
            }
        }

        function decreaseCurrent(currentTime) {
            scope.currentBp--;
            if (scope.currentBp < 0) {
                scope.currentBp = scope.breakpoints.length - 1;
            }
        }

        // Given current time, returns true if current is pointing to right BP 
        // (the closest one that is less than current time)
        function currentIsSynced(currentTime) {
            if (typeof scope.breakpoints != 'undefined') {
                var currBP = scope.breakpoints[scope.currentBp].get("time");
                if (scope.currentBp === 0 && currentTime < scope.breakpoints[scope.currentBp].get("time")) {
                    return true;
                }
                if (scope.currentBp !== (scope.breakpoints.length - 1)) {
                    var forwardBP = scope.breakpoints[scope.currentBp + 1].get("time");
                    return ((currentTime < forwardBP) && (currentTime >= currBP));
                } else {
                    return currentTime >= currBP;
                }
            } return false;
        }

        // Given the current time, locates the closest breakpoint to set as the current BP
        function findCurrent(currentTime) {
            if (typeof scope.breakpoints != 'undefined') {
                if (currentTime < scope.breakpoints[0].get("time")) {
                    scope.currentBp = 0;
                    return; // If we're in that section before the 1st BP, just return true (we count it as part of 1st segment)
                }
                for (var i = 0; i < scope.breakpoints.length; i++) {
                    if (i === scope.breakpoints.length - 1) {
                        scope.currentBp = scope.breakpoints.length - 1;
                        return;
                    }
                    var bpstart = scope.breakpoints[i].get("time");
                    var bpend = scope.breakpoints[i+1].get("time");
                    if ((currentTime < bpend) && (currentTime >= bpstart)) {
                        scope.currentBp = i;
                        return;
                    }
                }
            }
        }

        // Resets the currentBp_start and currentBp_end variables
        function resetCurrentBpStartEnd() {
            if (typeof scope.breakpoints != 'undefined') {
                scope.currentBp_start = scope.breakpoints[scope.currentBp].get("time");
                scope.currentBp_start_formatted = timeParser.convertSeconds(scope.currentBp_start);
                if (scope.currentBp === scope.breakpoints.length - 1) {
                    scope.currentBp_end = scope.duration;
                } else {
                    scope.currentBp_end = scope.breakpoints[scope.currentBp + 1].get("time");
                }
                scope.currentBp_end_formatted = timeParser.convertSeconds(scope.currentBp_end);
                document.querySelector("youtube[id='"+scope.videoid+"'] .yt_miniscrubber input").min = scope.currentBp_start;
                document.querySelector("youtube[id='"+scope.videoid+"'] .yt_miniscrubber input").max = scope.currentBp_end;
            }
        }

        // Repositions breakpoints to line up with the video's custom bottom player
        // NOTE: Since IDs may start with a number, we need to select via [id=...]
        function positionBreakpoints() {
            if (typeof scope.breakpoints != 'undefined') {
                var bottomplayer_width = document.querySelector("youtube[id='"+scope.videoid+"'] .bottom_player input").offsetWidth;
                console.log(bottomplayer_width);
                for (var i = 0; i < scope.breakpoints.length; i++) {
                    var breakpoint = scope.breakpoints[i];
                    var position = Math.floor((breakpoint.get("time") / scope.duration) * bottomplayer_width);
                    var breakpointEl = angular.element(document.querySelector("[id='"+breakpoint.id+"']")).css("left", position+"px");
                }
            }
        }

        // Repositions the darker violet bar that indicates already played/passed segments
        function positionPlayedSegments() {
            if (typeof scope.breakpoints != 'undefined') {
                var bottomplayer_width = document.querySelector("youtube[id='"+scope.videoid+"'] .bottom_player input").offsetWidth;
                var breakpoint = scope.breakpoints[scope.currentBp];
                var playedWidth = Math.floor( (breakpoint.get("time") / scope.duration) * bottomplayer_width);
                angular.element(document.querySelector("youtube[id='"+scope.videoid+"'] .bottom_player .played")).css("width", playedWidth+"px");
            }
        }

        // Plays the notification animation and updates the notification text too
        function playNotification() {
            var notifEl = document.querySelector("youtube[id='"+scope.videoid+"'] .yt_notifications");

            angular.element(notifEl).removeClass("slideInOut");

            // To reapply the animation, we have to trigger a "reflow" between removing and adding classes
            // https://css-tricks.com/restart-css-animation/
            notifEl.offsetWidth = notifEl.offsetWidth;

            angular.element(notifEl).addClass("slideInOut");
        }

        // Provides access to the timeParser second parse method
        scope.parseTime = function(time){
            return timeParser.convertSeconds(time);
        }


        // --------------------------------------------------
        // MANAGING VISIBILITY OF FULLSCREEN CONTROLS

        // Makes the controls fade in and appear, and automatically handles making it disappear when not hit in a while
        scope.toggleControls = function() {
            window.clearTimeout(scope.controlFadeTimeout);
            scope.fadeInControls();
            scope.controlFadeTimeout = window.setTimeout(scope.fadeOutControls, 2500);
        }

        // Without the fade effect, shows the fullscreen player controls
        scope.fastShowControls = function() {
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).addClass("fadedIn");
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).removeClass("fadedOut");
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).removeClass("fadeOut");
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).removeClass("fadeIn");
        }

        // Fadein the fullscreen player controls
        scope.fadeInControls = function() {
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).removeClass("fadedOut");
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).removeClass("fadeOut");
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).addClass("fadeIn");
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).addClass("fadedIn");
        }

        // Fadeout the fullscreen player controls
        scope.fadeOutControls = function() {
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).removeClass("fadedIn");
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).removeClass("fadeIn");
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).addClass("fadeOut");
            angular.element(document.querySelectorAll("youtube[id='"+scope.videoid+"'] .yt_playoverlay")).addClass("fadedOut");
        }

        function hideLoading() {
            angular.element(document.querySelector("youtube[id='"+scope.videoid+"'] .videoLoading")).addClass("hide");
        }

        function videoNotFound() {
            angular.element(document.querySelector("youtube[id='"+scope.videoid+"'] .loading")).addClass("hide");
            angular.element(document.querySelector("youtube[id='"+scope.videoid+"'] .notFound")).removeClass("hide");
        }




    }
  };
})

.directive('breakpointer', function($window, $interval) {
  return {
    restrict: "E",

    scope: {
      videoid:  "@",
      player: "=", // iFrame YT player element  
    },

    templateUrl: './directives/breakpointer.html',

    link: function(scope, element) {
      var tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      var firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      initPage();
      function initPage() {
        if ((typeof(YT) !== "undefined") && (typeof(YT.Player) !== "undefined")) {
          setPlayer();
        } else { // Youtube API still not loaded, wait a second and try again
          console.log("try again");
          setTimeout(function() {initPage();}, 1000);
        }
      }

      function setPlayer() {
        scope.player = new YT.Player(element.children()[0], {
          height: 390,
          width: 640,
          videoId: scope.videoid,
          playerVars: {
            autoplay: 0,
            html5: 1,
            theme: "light",
            modestbranding: 1,
            color: "white",
            iv_load_policy: 3,
            showinfo: 0,
            iv_load_policy: 3,
            playsinline: 1
          },
        });
      }

      // PLAYER EVENT LISTENERS
      scope.$on('getCurrentTime', function() { getCurrentTime(); })

      function getCurrentTime() {
        scope.player.pauseVideo();
        var currentTime = scope.player.getCurrentTime();
        scope.$parent.breakpoint.time = Math.round(currentTime);
      }

    }
  }
});

