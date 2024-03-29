        function hashChanged() {
            var target = location.hash.replace('#', '') || 'default';
            var success = false;
            Array.prototype.forEach.call(document.querySelectorAll(
                '#content .tab-target'), function (el) {
                if (el.getAttribute('data-target') === target) {
                    el.classList.remove('dnone');
                    success = true;
                } else {
                    el.classList.add('dnone');
                }
            });
            if (success === false) {
                location.hash = '#default';
            }
        }


        

        
        
        
        


        function UsersGroup(name, people, background, color) {
            this.name = name;
            this.people = people;
            this.background = background || 'transparent';
            this.color = color || 'white';
        }


        
        function setDisplayedSpamlist(number) {
            Array.prototype.forEach.call(document.querySelectorAll(
                '#spamlist-container > div'), function (el, i) {
                if (i === number) {
                    el.setAttribute('class', '');
                } else {
                    el.setAttribute('class', 'dnone');
                }
            });
            return false;
        }

        function generateTextareaShadow(color) {
            return 'box-shadow: 0 0 0 2px '+color+';';
        }
        
        
        var SPAMLIST_PREFIX =
            '[Spamlista](http://ginden.pl/scripts/abw.html)\n';

        function loadSpamlist(list) {
            var userTypes = [
                new UsersGroup('bordowi', 50, '#BB0000'),
                new UsersGroup('pomara┼äczowi', 20, '#FF5917'),
                new UsersGroup('zieloni', 10, '#339933'),
            ];
            var buttons = document.createDocumentFragment();
            var spamLists = document.createDocumentFragment();
            var tempSpamList;
            var tempTextarea;
            var tempButton;
            var userGroup;
            var chunkedUsers;
            var el;
            for (var i = 0; i < userTypes.length; i++) {
                userGroup = userTypes[i];
                tempButton = document.createElement('a');
                tempButton.setAttribute('href', '#');
                tempButton.addEventListener('click', setDisplayedSpamlist.bind(
                    tempButton, i, userGroup))
                tempButton.setAttribute('style', 'background-color: ' +
                    userGroup.background + '; color: ' + userGroup.color
                );
                tempButton.setAttribute('class', 'tab');
                tempButton.innerHTML = userTypes[i].name;
                buttons.appendChild(tempButton);

                tempSpamlist = document.createElement('div');
                chunkedUsers = list.chunk(userGroup.people)
                    .map(function (el) {
                        return el.map(function (el) {
                                return '@' + el
                            })
                            .join(' ');
                    });
                chunkedUsers[0] = SPAMLIST_PREFIX + chunkedUsers[0];
                while (el = chunkedUsers.shift()) {
                    tempTextarea = document.createElement('textarea');
                    tempTextarea.value = el;
                    tempTextarea.setAttribute('readonly', 'readonly');
                    tempTextarea.setAttribute('rows', (userGroup.people / 5) |
                        0);
                    tempTextarea.setAttribute('style', generateTextareaShadow(userGroup.background))
                    tempTextarea.addEventListener('click', function () {
                        this.focus();
                        this.select();
                        return false;
                    })
                    tempSpamlist.appendChild(tempTextarea);
                }

                tempSpamlist.setAttribute('id', '#spamlist-' + i);


                spamLists.appendChild(tempSpamlist);

            }
            document.querySelector('#spamlist .tabs')
                .appendChild(buttons);
            document.querySelector('#spamlist-container')
                .appendChild(spamLists);
            setDisplayedSpamlist(0);
        }
        


        
        window.addEventListener("hashchange", hashChanged, false);
        
        setTimeout(hashChanged, 20);
        
        Array.prototype.forEach.call(document.querySelectorAll('a.show'), function(el, i) {
            el.onclick = myLittleGallery;
        });
