/*************
 *
 * GIF Player
 *
 *************/

(function ($) {

    'use strict';
    var isEnabled   = g1.config.use_gif_player;

    g1.gifPlayer = function ($scope) {
        if ( ! isEnabled ) {
            return;
        }
        if (! $scope ) {
            $scope = $('body');
        }

        // SuperGif library depends on the overrideMimeType method of the XMLHttpRequest object
        // if browser doesn't support this method, we can't use that library
        if ( typeof XMLHttpRequest.prototype.overrideMimeType === 'undefined' ) {
            return;
        }

        g1.gifPlayerIncludeSelectors =[
            '.entry-content img.aligncenter[src$=".gif"]',
            '.entry-content .aligncenter img[src$=".gif"]',
            'img.g1-enable-gif-player',
            '.entry-featured-media-main img[src$=".gif"]',
            '.entry-tpl-stream .entry-featured-media img[src$=".gif"]',
            '.entry-tpl-grid-l .entry-featured-media img[src$=".gif"]'
        ];

        g1.gifPlayerExcludeSelectors = [
            '.ajax-loader',             // for Contact Form 7
            '.g1-disable-gif-player'
        ];

        $( g1.gifPlayerIncludeSelectors.join(','), $scope ).not( g1.gifPlayerExcludeSelectors.join(',') ).each(function () {
            var $img = $(this);
            var imgClasses = $img.attr('class');
            var imgSrc = $img.attr('src');

            // Check only absolute paths. Relative paths, by nature, are from the same domain.
            if (-1 !== imgSrc.indexOf('http')) {
                // Only locally stored gifs, unless user decided otherwise.
                if (imgSrc.indexOf(location.hostname) === -1 && !$img.is('.g1-enable-gif-player')) {
                    return;
                }
            }

            var gifObj = new SuperGif({
                gif: this,
                auto_play: 0
            });

            var $gitIndicator = $('<span class="g1-indicator-gif g1-loading">');

            gifObj.load(function() {
                var frames = gifObj.get_length();

                var $canvasWrapper = $(gifObj.get_canvas()).parent();

                // Only for animated gifs.
                if (frames > 1) {
                    var isPlaying = false;

                    var playGif = function() {
                        gifObj.play();
                        isPlaying = true;
                        $gitIndicator.addClass('g1-indicator-gif-playing');
                    };

                    var pauseGif = function() {
                        gifObj.pause();
                        isPlaying = false;
                        $gitIndicator.removeClass('g1-indicator-gif-playing');
                    };

                    if (!g1.isTouchDevice()) {
                        $canvasWrapper.on('click', function(e) {
                            // Prevent redirecting to single post.
                            e.preventDefault();

                            if (isPlaying) {
                                pauseGif();
                            } else {
                                playGif();
                            }
                        });
                    } else {
                        $canvasWrapper.on('hover', function() {
                            playGif();
                        });
                    }

                    // API.
                    $canvasWrapper.on('bimberPlayGif', playGif);
                    $canvasWrapper.on('bimberPauseGif', pauseGif);

                    $gitIndicator.toggleClass('g1-loading g1-loaded');

                    $(document).trigger('bimberGifPlayerLoaded', [$canvasWrapper]);
                } else {
                    // It's just a gif type image, not animation to play.
                    $gitIndicator.remove();
                }
            });

            // canvas parent can be fetched after gifObj.load() call
            var $canvasWrapper = $(gifObj.get_canvas()).parent();

            $canvasWrapper.
                addClass(imgClasses + ' g1-enable-share-links').
                attr('data-img-src', imgSrc).
                append($gitIndicator);
        });
    };

})(jQuery);


/*************
 *
 * MP4 Player
 *
 *************/

(function ($) {

    'use strict';

    g1.mp4Player = function () {
        // We depend on mediaelement.js
        if ( typeof mejs === 'undefined' ) {
            return;
        }

        g1.mp4PlayerIncludeSelectors =[
            '.entry-content .mace-video',
            '.entry-featured-media .mace-video',
            '.g1-enable-mp4-player'
        ];

        g1.mp4PlayerExcludeSelectors = [
            '.g1-disable-mp4-player'
        ];

        $( g1.mp4PlayerIncludeSelectors.join(',') ).not( g1.mp4PlayerExcludeSelectors.join(',') ).each(function () {
            var $video = $(this);
            var $mejsContainer = $video.parents('.mejs-container');
            var playerId;
            var player;

            // Hide controls.
            $mejsContainer.find('.mejs-controls').remove();

            // Set up player.
            $video.attr('loop', 'true');

            $mejsContainer.hover(
                // In.
                function() {
                    // Get player on first access.
                    if (!player) {
                        playerId = $mejsContainer.attr('id');
                        player   = mejs.players[playerId];
                    }

                    // Player loaded?
                    if (player) {
                        player.play();
                    }
                },
                // Out.
                function() {}
            );
        });
    };

})(jQuery);

/**********************
 *
 * Auto Play Video
 *
 **********************/

(function ($) {

    'use strict';

    var selectors = {
        'videoPost':         '.archive-body-stream .entry-tpl-stream .entry-featured-media:not(.entry-media-nsfw-embed)',
        'videoWrapper':      '.g1-fluid-wrapper-inner',
        'videoIframe':       '.g1-fluid-wrapper-inner iframe',
        'maceButton':        '.g1-fluid-wrapper-inner .mace-play-button',
        'embedly':           '.embedly-card iframe',
        'mejs':              '.mejs-video',
        'mejsButton':        '.mejs-video .mejs-overlay-button',
        'mejsPause':         '.mejs-video .mejs-pause',
        'mejsPlay':          '.mejs-video .mejs-play',
        'mejsMute':          '.mejs-video .mejs-mute button',
        'jsgif':             '.jsgif',
        'html5Video':         '.snax-native-video'
    };

    // Due to varied autoplay browsers' policies, it's almost impossible to guarantee autoplying on mobiles, so we turn it off.
    g1.isAutoPlayEnabled   = g1.config.auto_play_videos && ! g1.isTouchDevice();

    var playingIds          = [];   // Ids of all posts currently playing.
    var playingQueue        = [];   // All "videPosts" currently playing.
    var playedIds           = [];   // Ids of all posts playing or played (if id is here, we resume it instead of play next time).

    g1.autoPlayVideo = function () {
        if ( ! g1.isAutoPlayEnabled ) {
            return;
        }

        var addToQueue = function(element) {
            var postId = $(element).parents('article').attr('id');

            playingQueue.push(element);
            playingIds.push(postId);
            playedIds.push(postId);
        };

        var getFromQueue = function() {
            var element = playingQueue.pop();

            var postId = $(element).parents('article').attr('id');
            var index  = playingIds.indexOf(postId);

            if (index > -1) {
                playingIds.splice(index, 1);
            }

            return element;
        };

        var pauseAllVideos = function() {
            if (playingQueue.length === 0) {
                return;
            }

            g1.log('Pause all videos');
            g1.log(playingQueue);

            while (playingQueue.length > 0) {
                var element = getFromQueue();

                pause(element);
            }
        };

        var play = function(element) {
            var postId   = $(element).parents('article').attr('id');
            var $iframe  = $(selectors.videoIframe, element);
            var $embedly = $(selectors.embedly, element);
            var $mace    = $(selectors.maceButton, element);
            var $mejs    = $(selectors.mejsButton, element);
            var $jsgif   = $(selectors.jsgif, element);
            var $html5   = $(selectors.html5Video, element);
            var videosInPost = $iframe.length + $embedly.length + $mace.length + $mejs.length + $jsgif.length + $html5.length;

            // Element is a video to play?
            if (videosInPost > 0) {
                // Before playing this video we want to make sure that others video are paused too.
                pauseAllVideos();
            } else {
                return;
            }

            // IFRAME.
            if ($iframe.length > 0 ) {
                var iframesrc = false;

                if ($iframe.attr('data-src')) {
                    iframesrc= $iframe.attr('data-src');
                } else {
                    iframesrc= $iframe.attr('src');
                }

                if ( iframesrc ) {
                    var separator = '?';

                    if (iframesrc.indexOf('?') > 0){
                        separator = '&';
                    }

                    if (iframesrc.indexOf('youtu') > 0){
                        // Already played?
                        if (-1 !== playedIds.indexOf(postId)) {
                            // Resume.
                            $iframe[0].contentWindow.postMessage(JSON.stringify({
                                    'event': 'command',
                                    'func': 'playVideo',
                                    'args': ''}),
                                '*');
                        } else {
                            $iframe.on('load', function() {
                                // Mute on load.
                                $iframe[0].contentWindow.postMessage(JSON.stringify({
                                        'event': 'command',
                                        'func': 'mute',
                                        'args': ''}),
                                    '*');
                            });

                            $iframe.attr('src', iframesrc + separator + 'autoplay=1&enablejsapi=1');
                        }
                    }

                    if (iframesrc.indexOf('dailymotion') > 0){
                        // Already played?
                        if (-1 !== playedIds.indexOf(postId)) {
                            $iframe[0].contentWindow.postMessage('play', '*');
                        } else {
                            // Mute on load.
                            $iframe.attr('src', iframesrc + separator + 'autoplay=1&api=postMessage&mute=1');
                        }
                    }

                    if (iframesrc.indexOf('vimeo') > 0){
                        // Already played?
                        if (-1 !== playedIds.indexOf(postId)) {
                            // Resume playing.
                            $iframe[0].contentWindow.postMessage(JSON.stringify({
                                method: 'play'
                            }), '*');
                        } else {
                            // Mute on load.
                            $iframe.on('load', function() {
                                $iframe[0].contentWindow.postMessage(JSON.stringify({
                                    method: 'setVolume',
                                    value:  0
                                }), '*');
                            });

                            $iframe.attr('src', iframesrc + separator + 'autoplay=1&autopause=0');
                        }
                    }
                }
            }

            // Embedly player.
            if (typeof embedly !== 'undefined'){
                if ($embedly.length > 0 ) {
                    // the following iterates over all the instances of the player.
                    embedly('player', function(player){
                        if ($embedly[0] === $(player.frame.elem)[0]) {
                            player.play();
                            player.mute();
                        } else {
                            player.pause();
                        }
                    });
                } else {
                    embedly('player', function(player){
                        player.pause();
                    });
                }
            }

            // MediaAce YouTube lazy loader.
            if ($mace.length > 0) {
                var $maceWrapper = $mace.parent();

                // Mute on load.
                $maceWrapper.on('maceIframeLoaded', function(e, $iframe) {
                    $iframe[0].contentWindow.postMessage(JSON.stringify({
                            'event': 'command',
                            'func': 'mute',
                            'args': ''}),
                        '*');
                });

                $mace.trigger('click');
            }

            // MEJS player (MP4).
            if ($mejs.length > 0) {
                $mejs.trigger('click');

                // Mute on load.
                var playerId = $mejs.parents('.mejs-container').attr('id');

                if (playerId && mejs && typeof mejs.players !== 'undefined') {
                    var player = mejs.players[playerId];

                    player.setVolume(0);
                }
            }

            // GIF player.
            if ( $jsgif.length > 0 ) {
                setTimeout(function() {
                    $jsgif.trigger('bimberPlayGif');
                }, 500);
            }

            // Native HTML5 videos
            if ( $html5.length > 0 ) {
                $html5[0].play();
            }

            addToQueue(element);
        };

        var pause = function (element) {
            var $triggerediframe = $(selectors.videoIframe, element);

            if ($triggerediframe.length > 0 ) {
                var iframesrc=false;
                if ($triggerediframe.attr('data-src')) {
                    iframesrc= $triggerediframe.attr('data-src');
                } else {
                    iframesrc= $triggerediframe.attr('src');
                }
                if ( iframesrc ) {
                    if (iframesrc.indexOf('youtu') > 0){
                        $triggerediframe[0].contentWindow.postMessage(JSON.stringify({
                                'event': 'command',
                                'func': 'pauseVideo',
                                'args': ''}),
                            '*');
                    }
                    if (iframesrc.indexOf('dailymotion') > 0){
                        $triggerediframe[0].contentWindow.postMessage('pause', '*');
                    }
                    if (iframesrc.indexOf('vimeo') > 0){
                        $triggerediframe[0].contentWindow.postMessage(JSON.stringify({
                            method: 'pause'
                        }), '*');
                    }
                }
            }

            if (typeof embedly !== 'undefined'){
                var $embedly = $(selectors.embedly,element);
                if ($embedly.length > 0 ) {
                    embedly('player', function(player){
                        if ($embedly[0] === $(player.frame.elem)[0]) {
                            player.pause();
                        }
                    });
                }
            }

            $(selectors.mejsPause, element).trigger('click');

            var $jsgif   = $(selectors.jsgif, element);
            $jsgif.trigger('bimberPauseGif');

            var $html5 = $(selectors.html5Video, element);
            if ( $html5.length > 0 ) {
                $html5[0].pause();
            }
        };

        // If video post id is still in array, video is still in viewport and can be played.
        var canBeAutoPlayed = function(postId) {
            return g1.isAutoPlayEnabled && -1 !== playingIds.indexOf(postId);
        };

        var bindEvents = function() {

            // Delay waypoint. User scroll activate events.
            var scrollEvents = 0;
            var allowPlaying = false;

            // Wait for user scroll. Not scroll event while page loading.
            $(document).scroll(function() {
                scrollEvents++;

                if (scrollEvents > 5) {
                    allowPlaying = true;
                }
            });

            // ENTER, while up to down scrolling.
            $(selectors.videoPost).waypoint(function(direction) {
                if ('down' === direction) {
                    if (allowPlaying) {
                        g1.log('Play video (enter, direction: down)');

                        play(this.element);
                    }

                }
            }, {
                // When the bottom of the element hits the bottom of the viewport.
                offset: 'bottom-in-view'
            });

            // ENTER, while down to up scrolling.
            $(selectors.videoPost).waypoint(function(direction) {
                if ('up' === direction) {
                    if (allowPlaying) {
                        g1.log('Play video (enter, direction: up)');

                        play(this.element);
                    }
                }
            }, {
                // When the top of the element hits the top of the viewport.
                offset: '0'
            });

            // EXIT, while up to down scrolling.
            $(selectors.videoPost).waypoint(function(direction) {
                if ('down' === direction) {
                    g1.log('Pause (exit, direction: down)');

                    pause(this.element);
                }
            }, {
                offset: function() {
                    // Fires when top of the element is (HALF OF ELEMENT HEIGHT)px from the top of the window.
                    return -Math.round(this.element.clientHeight / 2);
                }
            });

            // EXIT, while down to up scrolling.
            $(selectors.videoPost).waypoint(function(direction) {
                if ('up' === direction) {
                    g1.log('Pause (exit, direction: up)');

                    pause(this.element);
                }
            }, {
                offset: function() {
                    var viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

                    // Fires when top of the element is (HALF OF ELEMENT HEIGHT)px from the bottom of the window.
                    return viewportHeight - Math.round(this.element.clientHeight / 2);
                }
            });

            // Play GIF on load.
            $(document).on('bimberGifPlayerLoaded', function(e, $canvasWrapper) {
                var postId = $canvasWrapper.parents('article').attr('id');

                if (canBeAutoPlayed(postId)) {
                    $canvasWrapper.trigger('bimberPlayGif');
                }
            });
        };

        bindEvents();
    };

})(jQuery);

/**************************
 *
 * document ready functions (keep this at the end for better compatibillity with optimizing plugins)
 *
 *************************/

(function ($) {

    'use strict';

    $(document).ready(function () {
        g1.gifPlayer();
        g1.autoPlayVideo();
    });

    $(window).load(function () {
        g1.mp4Player();
    });

})(jQuery);