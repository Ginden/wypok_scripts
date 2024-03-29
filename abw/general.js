        Object.defineProperty(Array.prototype, "chunk", {
            value: function (size) {
                var copy = this.slice(0);
                var chunks = [];
                while (copy.length > 0) {
                    chunks.push(copy.splice(0, size));
                }
                return chunks;
            },
            enumerable: false
        });
        
        function hasParent(child, parent) {
            var curr = child;
            while (parent && curr) {
                if (curr === parent) {
                    return true;
                }
                curr = curr.parentNode;
            }
            return false;
        }
        
        function setAttributes(element, data) {
            for (var key in data) {
                if (Object.hasOwnProperty.call(data, key)) {
                    element.setAttribute(key, data[key]);
                }
            }
            return element;
        }

        function postChangeAttribute(el, attr, howMany) {
            var i = Number(el.getAttribute(attr)) + howMany;
            el.setAttribute(attr, i);
            return i;
        }

        window.activeModal = false;
        
        document.addEventListener('click', function(e) {
            if (activeModal && !hasParent(e.target, document.querySelector('#modal'))) {
                modalClose();
            }
        }
        );
        
        function myLittleGallery() {
            var image = this.getAttribute('href');
            var size = Number(this.getAttribute('data-height'))
            setTimeout(getModalImage.bind(this, image, size),0);
            return false;
        }
        
        
        
        
        
        function modalNext() {
            var figure = this.parentNode.parentNode.querySelector('figure');
            figure.style.backgroundPosition = '0% '+postChangeAttribute(figure, 'data-position', 1)*figure.getAttribute('data-single-height') + 'px';
            
        }
        function modalPrev() {
            var figure = this.parentNode.parentNode.querySelector('figure');
            figure.style.backgroundPosition = '0% '+postChangeAttribute(figure, 'data-position', -1)*figure.getAttribute('data-single-height') + 'px';
        }
        function modalClose() {
            document.querySelector('#modal').setAttribute('class', 'dnone');
        }
        function getModalImage(url, size) {
            var myModal;
            myModal = document.querySelector('#modal');
            var miniTable = setAttributes(document.createElement('div'), {class: 'navigation'})
            var button;
            if (myModal === null) {
                myModal = document.createElement('div');
                myModal.setAttribute('id', 'modal');
                myModal.setAttribute('class', 'dnone');
                
                button = document.createElement('button');
                button.setAttribute('id', 'prev');
                button.addEventListener('click', modalPrev);
                button.innerHTML = 'ÔćÉ';
                miniTable.appendChild(button);

                
                button = document.createElement('button');
                button.setAttribute('id', 'close');
                button.addEventListener('click', modalClose);
                button.innerHTML = 'x';
                miniTable.appendChild(button);
                

                button = document.createElement('button');
                button.setAttribute('id', 'next');
                button.innerHTML = 'Ôćĺ';
                button.addEventListener('click', modalNext);
                
                miniTable.appendChild(button);
                
                myModal.appendChild(miniTable);
                myModal.appendChild(document.createElement('figure'))
                
                
                document.body.appendChild(
                    myModal
                )
            }
            myModal.querySelector('figure').outerHTML = '<figure></figure>';
            var myImage = new Image();
            myImage.src = url;
            myModal.querySelector('figure').appendChild(myImage);
            myImage.addEventListener('load', function() {
                var figure = myModal.querySelector('figure');
                setAttributes(figure, {
                    'data-single-height': (myImage.height/size)|0,
                    'data-original-height': myImage.height,
                    'data-original-width': myImage.width,
                    'data-position': 0
                });
                figure.style.backgroundImage = 'url("'+url+'")';
                figure.style.width = myImage.width+'px';
                figure.style.height = ((myImage.height/size)|0)+'px';
                (myImage.parentNode||myImage).removeChild(myImage);
                myModal.setAttribute('class', '');
                activeModal = true;
            })
            
        }
