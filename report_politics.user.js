// ==UserScript==
// @name        Szybkie zgłaszanie braku #polityka
// @namespace   report_politics
// @include     http://www.wykop.pl/mikroblog/*
// @include     http://www.wykop.pl/wpis/*
// @include     http://www.wykop.pl/tag/*
// @include     http://www.wykop.pl/moj/*
// @version     1
// @downloadURL https://ginden.github.io/wypok_scripts/report_politics.user.js
// @grant       none
// ==/UserScript==


"use strict";
var script = document.createElement("script");
script.textContent = "(" + main.toString() + ")();";
document.body.appendChild(script);
function main() {

    if (window.wykop) {
        window.wykop.plugins = window.wykop.plugins || {};
        window.wykop.plugins.Ginden = window.wykop.plugins.Ginden || {};
        window.wykop.plugins.Ginden.ReportPolitics = {};
    }

    var lenny = String.fromCharCode.apply(null, [40, 32, 865, 176, 32, 860, 662, 32, 865, 176, 41]);

    function createTagReportType(tag) {
        return function reportPoliticsClick(e) {
            e.preventDefault();
            var id = $(this).parents('div[data-type="entry"]').attr('data-id');
            var type = 'entry';
            $.ajax({
                type: "POST",
                url:  getReportUrl(type, id),
                data: {
                    'violation[reason]':      "35",
                    'violation[info]':        '#' + tag,
                    'violation[object_type]': "entry",
                    'violation[object_id]':   id
                }
            }).success(function () {
                alert('Zgłoszono brak #' + tag);
            });
            return false;
        }
    }


    function reportVotersSilence(e) {
        e.preventDefault();
        var id = $(this).parents('div[data-type="entry"], div[data-type="entrycomment"]').attr('data-id');
        var type = $(this).parents('div[data-type="entry"], div[data-type="entrycomment"]').attr('data-type');
        $.ajax({
            type: "POST",
            url:  getReportUrl(type, id),
            data: {
                'violation[reason]':      "43",
                'violation[info]':        'Naruszenie ciszy wyborczej. ' + lenny,
                'violation[object_type]': type,
                'violation[object_id]':   id
            }
        }).success(function () {
            alert('Zgłoszono naruszenie ciszy wyborczej');
        });
        return false;
    }


    function getReportUrl(type, id) {
        return 'http://www.wykop.pl/ajax/naruszenia/new/' + type + '/' + id + '/hash/' + window.wykop.params.hash + '/';
    }

    var $reportPolitics = $('<a href="#" class="affect hide btnNotify"><i class="fa fa-flag-o"></i>#polityka</a>');
    var $reportNsfw = $('<a href="#" class="affect hide btnNotify"><i class="fa fa-flag-o"></i>#nsfw</a>');
    var $reportSilence = $('<a href="#" class="affect hide btnNotify"><i class="fa fa-flag-o"></i>cisza</a>')
    $reportPolitics.click(createTagReportType('polityka')).attr('title', 'zgłoś brak #polityka');
    $reportNsfw.click(createTagReportType('nsfw')).attr('zgłoś brak #nsfw');
    $reportSilence.click(reportVotersSilence).attr('title', 'naruszenie ciszy wyborczej');

    function addButtons() {
        [].forEach.call(document.querySelectorAll('div[data-type="entry"]:not(.gr_improved) a.btnNotify'), function (el) {
            var parent = el.parentNode;
            var $parent = $(parent);
            if ($parent.closest('div[data-type]').hasClass('gr_improved') === false) {
                $parent.closest('div[data-type]').toggleClass('gr_improved', true);

                $parent.after(
                    $('<li class="report_entry_immproved" />').append($reportPolitics.clone(true)),
                    $('<li class="report_entry_immproved" />').append($reportSilence.clone(true)),
                    $('<li class="report_entry_immproved" />').append($reportNsfw.clone(true))
                );

            }
        });
        [].forEach.call(document.querySelectorAll('div[data-type="entrycomment"]:not(.gr_improved) a.btnNotify'), function (el) {
            var parent = el.parentNode;
            var $parent = $(parent);

            if ($parent.closest('div[data-type]').hasClass('gr_improved') === false) {
                $parent.after(
                    $('<li class="report_entrycomment_improved" />').append($reportSilence.clone(true))
                );
                $parent.closest('div[data-type]').toggleClass('gr_improved', true);
            }



        });
    }

    function throttle(fn, ms) {
        var lastTime = -Infinity;
        return function cloq(){
            if ((Date.now()-ms) > lastTime) {
                fn.apply(this, arguments);
                lastTime = Date.now();
            }
            return undefined;
        }
    }

    addButtons();
    var mutationObserver = new MutationObserver(throttle(addButtons, 64));
    mutationObserver.observe(document.querySelector('#itemsStream'), {
        childList: true,
        subtree:   true
    });


}