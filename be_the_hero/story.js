// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = '994ba59b6c';
squiffy.story.sections = {
	'_default': {
		'text': "<p><a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">Be the hero</a></p>",
		'passages': {
		},
	},
	'start': {
		'text': "<p>The night is young, the crowd bustling under cheerful hanging lights as the smell of delicious fried food fills the air. That isn&#39;t why you&#39;re here, though. You make your way onto the pier, the heart of the fair. Stretching down towards the dark ocean, food stalls line either side offering their wares.</p>\n<p>You easily blend into the crowd, becoming one of many as you weave your way through. It&#39;s like a dance, touching no one, turning no heads.  You&#39;re good at that, being invisible. No one sees you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">But someone does.</a></p>",
		'passages': {
		},
	},
	'_continue1': {
		'text': "<p>On the other side of the pier, behind the counter in a sushi stand, a man with vibrant red hair pulled up in a hairnet looks your way. Your eyes meet and the world freezes for a moment, just the two of you under the twinkling lights. He becomes a flurry of motion, his knife gutting and slicing the fish with expertise. Perfect slices of red meat spread out on the cutting board. He looks back at you and smiles. He looks down and doesn’t look at you again. Was he trying to impress you?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">You keep looking.</a></p>",
		'passages': {
		},
	},
	'_continue2': {
		'text': "<p>Your <a class=\"squiffy-link link-passage\" data-passage=\"watch\" role=\"link\" tabindex=\"0\">watch</a> beeps. You press one of the buttons, silencing the alarm. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">You don’t have time for this.</a></p>",
		'passages': {
			'watch': {
				'text': "<p>It&#39;s a hefty metal contraption, with various buttons on the sides and a large display. It&#39;s really something more than a watch, but no one else knows. It&#39;s programmed to track your objective, to keep you on target. To communicate or send a distress call, if necessary. </p>",
			},
		},
	},
	'_continue3': {
		'text': "<p>Further down the dock, weaving through the crowd like a ghost. You know how to pass without leaving a mark, without attracting suspicion. It’s part of the <a class=\"squiffy-link link-passage\" data-passage=\"job\" role=\"link\" tabindex=\"0\">job</a>.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">You move on.</a></p>",
		'passages': {
			'job': {
				'text': "<p>It’s what you do. You deal in secrets and lies, you live in the shadows. <a class=\"squiffy-link link-passage\" data-passage=\"No one sees you.\" role=\"link\" tabindex=\"0\">No one sees you.</a></p>",
			},
			'No one sees you.': {
				'text': "<p>Someone saw you. <a class=\"squiffy-link link-passage\" data-passage=\"The memory of the chef lingers.\" role=\"link\" tabindex=\"0\">The memory of the chef lingers.</a></p>",
			},
			'The memory of the chef lingers.': {
				'text': "<p>You shake it off. Not part of the job.</p>",
			},
		},
	},
	'_continue4': {
		'text': "<p>The end of the pier is dark, empty. The hubbub of the crowd behind you and the flat black expanse of the ocean before you. None of the revelers stray this far out of the lights. Perfect. There&#39;s supposed to be something for you here, a dead drop.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue5\" role=\"link\" tabindex=\"0\">You look around.</a></p>",
		'passages': {
		},
	},
	'_continue5': {
		'text': "<p>Fishing tackle and other equipment is laying around. The only place you can&#39;t directly see is inside a coil of thick rope.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue6\" role=\"link\" tabindex=\"0\">Reach inside.</a></p>",
		'passages': {
		},
	},
	'_continue6': {
		'text': "<p>You do so, fingers brushing against canvas. Bingo. You pull out a nondescript duffel bag, setting it down on the pier beside you. You unzip the bag and pull out your <a class=\"squiffy-link link-passage\" data-passage=\"dive equipment\" role=\"link\" tabindex=\"0\">dive equipment</a>.</p>\n<p>You don the drysuit over your clothes and slip the fins on your feet. You attach the regulator hoses to the cylinder and sling it onto your back. You hold the mouthpiece between your teeth and hear your own breath hissing in your ears. The mask covers your eyes, narrowing your field of vision. That&#39;s fine, there&#39;s nothing to see out here anyway.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue7\" role=\"link\" tabindex=\"0\">You step off the edge of the pier and plunge into the dark water below.</a></p>",
		'passages': {
			'dive equipment': {
				'text': "<p>Dive cylinder, regulator, mask, fins, drysuit.</p>",
			},
		},
	},
	'_continue7': {
		'text': "<p>The water is cold but you don’t feel it through your suit. You’re an athlete, a strong swimmer, so it’s no challenge to swim for miles out to a small island off the coast. The water is deep and calm, stretching down underneath you into inky blackness. A little fish in a big sea. Checking your route occasionally on your watch display, you have plenty of time to think.</p>\n<p>Intel has recently revealed that your enemy uses this island for secret meetings. The information you could uncover here would be invaluable. Dates, locations, associates. Anything to put you one step ahead. You run through schematics in your mind, picturing the long endless halls, running through simulations and planning your path as you sneak past the guards. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue8\" role=\"link\" tabindex=\"0\">Your watch beeps.</a></p>",
		'passages': {
		},
	},
	'_continue8': {
		'text': "<p>Surfacing, you see the island loom out of the darkness in front of you. It&#39;s barely more than a rock, a smattering of wind-blown trees clinging to its surface surrounding a stout, utilitarian building.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue9\" role=\"link\" tabindex=\"0\">Your target.</a></p>",
		'passages': {
		},
	},
	'_continue9': {
		'text': "<p>You rise from the water, stumbling onto the rocky shore. You remove your dive gear, concealing it in the rocky terrain for a quick exit. You creep towards the building, low to the ground and alert for any sounds or signs of movement. All you hear and see is the rustle of wind through the trees. As you get closer, a door opens on the side of the building, a spotlight of bright white in the darkness. You flatten your body against a rock and peer over the edge, transfixed. You watch, all senses focused on spot of light. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue10\" role=\"link\" tabindex=\"0\">Watch it.</a></p>",
		'passages': {
		},
	},
	'_continue10': {
		'text': "<p>You don’t even hear the two burly men behind you until it&#39;s too late. They&#39;re on you before you can react. You put up a brief fight but are quickly overcome as one clubs you over the back of the neck. The other pins you to the ground, twisting your arms behind you with a knee on your back. You struggle, but he’s too big for you. </p>\n<p>You&#39;re right in front of the door now, prostrate in the path of light shining from the interior. Slowly the light dims, eclipsed by a massive silhouette that appears from within. All you can make out is the shape, an enormous figure barely able to fit through the frame. He approaches you, one agonizing step at a time, but all you can make out is his <a class=\"squiffy-link link-passage\" data-passage=\"shoes\" role=\"link\" tabindex=\"0\">shoes</a>. </p>\n<p>When the man speaks you don&#39;t have to see his face to know he&#39;s smiling. “Well, well, well. I was hoping you would come tonight; I’ve heard ever so much about you. What a pleasure to finally make your acquaintance, Agent.”</p>\n<p>As if rehearsed, the man on top of you digs his knee in, and you don’t have time to react before you feel a <a class=\"squiffy-link link-passage\" data-passage=\"pinch\" role=\"link\" tabindex=\"0\">pinch</a> in the side of your neck and the world fades away, the dark shape of your enemy overtaking you. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero1\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain0\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
			'shoes': {
				'text': "<p>Smart black patent leather. It&#39;s safe to assume the rest of him is as sharply dressed.</p>",
			},
			'pinch': {
				'text': "<p>It&#39;s a needle. They&#39;re drugging you.</p>",
			},
		},
	},
	'villain0': {
		'text': "<p>You stare down at his unconscious body, tutting quietly. His face is bloody, clothes covered in dirt and torn from his scuffle. Such a shame to see a handsome man in this state. You decide it’s the least you can do to take care of him, personally.  </p>\n<p>You dismiss your men, no gawkers allowed as you place him in a chair and wheel his limp body down the hall, to your private showers. You turn the shower handle with a creak, running the water pleasantly hot. Steam fills the air as you disrobe him, stringing his naked body up in a <a class=\"squiffy-link link-passage\" data-passage=\"support harness\" role=\"link\" tabindex=\"0\">support harness</a>. While he hangs you get ready, laying out fresh towels and covering your expensive suit in a clear plastic poncho. You take your time. You know he&#39;s going to be out for <a class=\"squiffy-link link-passage\" data-passage=\"hours\" role=\"link\" tabindex=\"0\">hours</a>.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue11\" role=\"link\" tabindex=\"0\">Bathe him</a></p>",
		'passages': {
			'support harness': {
				'text': "<p>It&#39;s made from handsome black leather, hung from a massive chain attached directly to a solid steel I-beam in the ceiling. It&#39;s clearly not made for him.</p>",
			},
			'hours': {
				'text': "<p>He doesn&#39;t know you have a mole inside his agency, feeding you information, rotting it from within. You have his complete files, you&#39;ve perused them at length. You know <a class=\"squiffy-link link-passage\" data-passage=\"everything\" role=\"link\" tabindex=\"0\">everything</a> about him: height, weight, blood type. It was easy to calculate the precise dose to properly subdue him.</p>",
			},
			'everything': {
				'text': "<p>Everything you can know from a file. You want to know <em>him</em>.</p>",
			},
		},
	},
	'_continue11': {
		'text': "<p>The shower nozzle is cold and firm in your hand, the water hot. You turn the stream on him, washing away the dirt and blood. You lather a sponge and rub it over his body, turning him this way and that as you appreciate his curves. He&#39;s lean, with a shapely chest and ass, toned arms and legs. He cleans up nicely. Appreciating him up close like this... </p>\n<p>You feel your arousal throb in your pants. Wouldn&#39;t that be fun? No, this is strictly professional. You keep your hands to yourself.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero1\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain1\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
		},
	},
	'villain1': {
		'text': "<p>You’re almost done. Your back is turned, rinsing out the sponge, when you hear the rattle of chains behind you. It’s faint, but... your head swivels around to catch his eyes, wide open and darting around. What? This shouldn’t be <a class=\"squiffy-link link-passage\" data-passage=\"possible\" role=\"link\" tabindex=\"0\">possible</a>.  </p>\n<p>His head bobs fitfully, rattling the chains again, but the rest of him is stock still, not even a twitch. A smile splits your lips. Ah, so it’s like that then. The sedative may have worn off but the paralytic is in full effect. He can’t move.  You weren’t expecting this, but maybe you can have make the most of it. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero2\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain2\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
			'possible': {
				'text': "<p>You have his file, you know his weight, you gave him the right dose, he should still be out for hours.</p>",
			},
		},
	},
	'villain2': {
		'text': "<p>The panic is clear in his eyes as he looks at you. You relish this feeling, having him under your control like this. You approach slowly, deliberately. Every motion calculated as you kneel and rub the soapy sponge down his legs, over the supple muscle of his thighs. He won&#39;t look at you. Struggling to remember his training. You feel his heart beat through every vein, trapped like a wild animal. He can&#39;t hide it, he&#39;s scared. And you love to watch him squirm. </p>\n<p>You eye his flaccid cock. Maybe you can have some fun with this after all.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero3\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain3\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
		},
	},
	'villain3': {
		'text': "<p>You bring the sponge up, rubbing in circles over his crotch. Ostensibly cleaning, yes, but you both know it&#39;s more than that. You feel turgid pressure, resistance under the sponge. He&#39;s getting there.</p>\n<p>&quot;I am nothing if not thorough,&quot; you purr, &quot;I must make sure you are clean all over, mustn&#39;t I?&quot;</p>\n<p>He&#39;s quiet but you can still hear his uneven breathing. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue12\" role=\"link\" tabindex=\"0\">Touch him.</a></p>",
		'passages': {
		},
	},
	'_continue12': {
		'text': "<p>Foregoing the sponge now, you take his manhood in hand, languidly stroking as he becomes fully hard in your grip. Fingering the tip, you notice his thick, puckered foreskin. You slide your finger inside, circling the head. Pulling the foreskin back, you can see he&#39;s clean, no smegma to speak of. He clearly takes care of himself. Impressive</p>\n<p>Pulling the foreskin back over the head, you stroke faster. You can feel his discomfort; the tension palpable in the air. It makes you giddy to have absolute power over him. Toying with him like a cat does a mouse. You fall into a steady rhythm, a slow build that has his breath quickening despite himself.</p>\n<p>You look up. He&#39;s still not looking at you, his face pinched. You squeeze his cock to get his attention.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue13\" role=\"link\" tabindex=\"0\">You speak.</a></p>",
		'passages': {
		},
	},
	'_continue13': {
		'text': "<p>&quot;Do you like this? Do you want to come?&quot;</p>\n<p>His eyes are sunken, his face grim. He&#39;s still resisting. &quot;No.&quot; Of course he wouldn&#39;t give in so easily.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero5\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain5\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
		},
	},
	'villain5': {
		'text': "<p>You keep touching him, but slower. You&#39;ve felt how eager he is, so you keep him just burning. It must be agony. You mean to break him.</p>\n<p>&quot;Are you sure? This is your last chance to take care of this. You&#39;ll be under constant surveillance once I send you to your cell, you simply won&#39;t have the opportunity.&quot;</p>\n<p>He remains silent. You keep touching him as you feel his resistance crumble bit by bit. It&#39;s worth the wait. </p>\n<p>&quot;Fine,&quot; he relents, finally submitting to your will. He may not think he&#39;s giving anything away, but it&#39;s everything. You smile. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero6\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain6\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
		},
	},
	'villain6': {
		'text': "<p>You feel his relief as you speed up. He seems to sink into himself as you stroke him, retreating into some fantasy deep within his mind. A bubble of frustration that he thinks he&#39;s escaped you. But he can&#39;t hide forever. He has to come back eventually. You read his body, playing him like an instrument, making him perform. Your reward is a forceful stream of semen, more than you think you&#39;ve ever seen. It shoots from the tip of his cock in spurts, splattering against the pristine tile wall. You watch, entranced, as it seems to go on forever. It&#39;s beautiful. </p>\n<p>When it&#39;s over, you wipe an errant drop off the tip of his cock and absently lick your finger. &quot;We were pent up, weren&#39;t we.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero7\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain7\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
		},
	},
	'villain7': {
		'text': "<p>You hose him down, running the water over every inch of his sweaty, soapy body. You can see him trembling, an involuntary response to the now <a class=\"squiffy-link link-passage\" data-passage=\"cold water\" role=\"link\" tabindex=\"0\">cold water</a>. You unhook him from the heavy chain, carrying him effortlessly to a nearby table you&#39;ve prepared, laid out with towels and an old prison jumpsuit. He doesn&#39;t look at you as you dry him and manipulate his limbs to dress him. You&#39;re gentle, like he&#39;s your favorite doll.</p>\n<p>You call your underlings on the intercom, waiting patiently until they retrieve the prisoner to deliver him to his cell. You stretch, imagining what you can do to him next time. This is going to be great fun.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"End.\" role=\"link\" tabindex=\"0\">End.</a> </p>",
		'passages': {
			'cold water': {
				'text': "<p>You didn&#39;t want him getting hypothermic when he was unconscious, but now it&#39;s just another way to add to his torment.</p>",
			},
		},
	},
	'hero1': {
		'text': "<p>You stir. Everything is still dark, but your other senses filter in. You hear the hissing of running water. Puffs of warm, humid air drift across your skin. It smells damp. You struggle to open your eyes and the world swims into focus. It’s hard to see at first through the drugged clouds in your eyes and the mist in the room. You see rows of immaculate tiles, blue or maybe green, a deep color that reminds you of the sea. The sound is coming from the corner, a waterfall shower head pours water onto the tiled floor, sending clouds of vapor into the air. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue14\" role=\"link\" tabindex=\"0\">You lift your arm...</a></p>",
		'passages': {
		},
	},
	'_continue14': {
		'text': "<p>Except you don’t. Despite every effort, it hangs limp at your side. Toes, legs, back, nothing moves. You think you manage to twitch your head slightly, there’s the quiet rattle of a chain in your ear, though it may be your imagination under the sound of running water. </p>\n<p>Your eyes clear, or maybe the mist does, and you make out a figure hunkered in front of you. Back turned, his broad shoulders fill your vision. Although he’s kneeling, his bent head is barely below your <a class=\"squiffy-link link-passage\" data-passage=\"eye level\" role=\"link\" tabindex=\"0\">eye level</a>. He must be massive. </p>\n<p>He turns, and in an instant his eyes capture yours. They’re piercing, you feel that you’ve already given something away. Desperate, your eyes dart this way and that, looking for an escape. You look down, finally, only to discover you’re naked, traces of soap suds clinging to your form. Your cock hangs between your legs, as limp as the rest of you. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero2\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain2\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
			'eye level': {
				'text': "<p>And you&#39;re suspended slightly. Your dangling toes don&#39;t touch the ground.</p>",
			},
		},
	},
	'hero2': {
		'text': "<p>You look up. You don&#39;t let the panic seep in as you meet his gaze. He approaches you, a coy smile on his face. He&#39;s got you right where he wants you, though you can&#39;t begin to guess his game. He kneels, the sponge lathering your legs, noticeably avoiding your groin. You wonder if he&#39;s already touched you there, before you gained consciousness. You feel sick, thinking of him molesting your unconscious body. You look away. You count the seconds as you breathe in and out. You are stone. Nothing can hurt you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero3\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain3\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
		},
	},
	'hero3': {
		'text': "<p>There&#39;s a pause, it&#39;s almost nothing but you notice. The sponge comes back up, trailing between your legs. He&#39;s washing you <em>there.</em>  He rubs with more purpose, trying to elicit some sort of response. You gulp down the bile rising in the back of your throat and bear it. </p>\n<p>&quot;You&#39;re my guest,&quot; he seems to purr, &quot;I must take care of you.&quot;</p>\n<p>It&#39;s now his hand on you, palm easily wrapped around your shaft as he begins to stroke you up and down sensually. You feel your cock harden in his grasp, a pleasurable tingling in your loins as your erection grows. You&#39;re disgusted with yourself. He works his finger into your thick foreskin, swirling the tip around the sensitive head of your cock, stretching you out. It feels good, but your stomach twists. You want him to stop. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue15\" role=\"link\" tabindex=\"0\">He doesn&#39;t.</a></p>",
		'passages': {
		},
	},
	'_continue15': {
		'text': "<p>He keeps touching you. There&#39;s so many ways he could choose to torture you, perhaps you should be grateful this is all he&#39;s chosen to do. You give nothing away, retaining your composure. He&#39;s going to do this to you, and there&#39;s nothing you can do to stop him. You feel him tug at you insistently.</p>\n<p>He&#39;s looking at you, waiting.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue16\" role=\"link\" tabindex=\"0\">He speaks.</a></p>",
		'passages': {
		},
	},
	'_continue16': {
		'text': "<p>&quot;Do you like this? Do you want to come?&quot;</p>\n<p>You close your eyes and grit your teeth. Your choice doesn&#39;t matter. Why does he want to make you say it? You&#39;re not going to give him what he wants.</p>\n<p>&quot;No.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero5\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain5\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
		},
	},
	'hero5': {
		'text': "<p>He slows the movements of his hand, keeping you agonizingly on the edge. It burns, this want. It&#39;s been so long since you last <a class=\"squiffy-link link-passage\" data-passage=\"touched yourself\" role=\"link\" tabindex=\"0\">touched yourself</a>. </p>\n<p>His voice is smug. &quot;Are you sure? There are cameras everywhere, except this room. If you think you can take care of this later, they&#39;ll record you touching yourself like the dirty slut you are. Everyone will see you, everyone will know. This is your last chance to save yourself the embarrassment.&quot; </p>\n<p>He gives you time to think about this, stringing you along. Giving you a taste of what you could have, but not enough to get you to the edge.</p>\n<p>You imagine the scenario. You know you&#39;ll be hard for agonizing hours until the stiffness subsides on its own. Being taken back to your cell in shame, what he did to you in here as clear as the bulge in your pants. And if you try to take care of it yourself... The eyes of his henchmen trained on the screens, watching you, laughing at you as you masturbate. No way. You can&#39;t let anyone see you like this. Even if that means...</p>\n<p>&quot;Fine,&quot; you relent, &quot;Do it.&quot; Whatever happens, as long as <a class=\"squiffy-link link-passage\" data-passage=\"no one\" role=\"link\" tabindex=\"0\">no one</a> knows.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero6\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain6\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
			'touched yourself': {
				'text': "<p>You don&#39;t even remember how long it&#39;s been. Could be weeks, months. There&#39;s never time. The mission always comes first.</p>",
			},
			'no one': {
				'text': "<p>Besides the two of you. You can keep a secret, can he?</p>",
			},
		},
	},
	'hero6': {
		'text': "<p>You feel sick. Is this what he wanted? To break you? You won&#39;t let him ruin you. You turn your thoughts inwards, elsewhere. The cute sushi chef. You fantasize about his eyes locked with yours, his flaming red hair. You imagine him naked, the shape of his body, the feel of it. He holds you in his arms and you orgasm.</p>\n<p>The dream fades away as you come back to cold, wet reality. The heady scent of cum sickens your post-coital senses, and you turn your head away from the sight of your seed splattered against the clean tile wall. Dirty. Just like you.</p>\n<p>He coos at you, clicking his tongue, &quot;We were pent up, weren&#39;t we.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero7\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain7\" role=\"link\" tabindex=\"0\">Be the villain</a></p>",
		'passages': {
		},
	},
	'hero7': {
		'text': "<p>He hoses you off, water cold against your flushed skin. It washes away the sweat of your lust, but it doesn&#39;t wash away the humiliation. He unhooks you from the ceiling and carries you effortlessly to a table laid out with a soft towel, and carefully, tenderly pats your body dry. </p>\n<p>You feel like a baby. Helpless. Incompetent. He slips you into a bright orange jumpsuit, emphasizing your status as his prisoner. He calls his men on the intercom, and soon someone is there to take you away, to the cell you are going to call home for the forseeable future. </p>\n<p>Your head is static down the long hallway back, and the next thing you know you&#39;re being unceremoniously dumped into bed. You still can&#39;t move. At least you don&#39;t have a boner anymore. You close your eyes and try not to cry.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"End.\" role=\"link\" tabindex=\"0\">End.</a> </p>",
		'passages': {
		},
	},
	'End.': {
		'clear': true,
		'text': "<p>Choose again?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"hero1\" role=\"link\" tabindex=\"0\">Be the hero</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"villain0\" role=\"link\" tabindex=\"0\">Be the villain</a></p>\n<p>Or <a class=\"squiffy-link link-section\" data-section=\"start\" role=\"link\" tabindex=\"0\">start over</a></p>",
		'passages': {
		},
	},
}
})();