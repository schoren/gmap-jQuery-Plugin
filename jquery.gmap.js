/**
 * Copyright 2010 Sebastian Choren
 * 
 * This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
(function( $ ){
    var methods = {
        init: function( options ) {
            if(options == undefined){
                options = {};
            }
            return this.each(function(){
                defaults = {
                    center: _getLatLonObject(51.4774, 0.0090),
                    mapTypeId: google.maps.MapTypeId.HYBRID,
                    mapTypeControlOptions: {
                        style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
                    },
                    zoom: 10,
                    disableDoubleClickZoom: true
                };
                if( options.mapType ){
                    options.mapTypeId = _getMapType(options.mapType);
                    delete options.mapType;
                }
                if(options.lat && options.lng){
                    options.center = _getLatLonObject(options.lat, options.lng);
                    delete options.lat;
                    delete options.lng;
                }
                options = $.extend(defaults, options);
                map = new google.maps.Map(this, options);
                $(this).data('gmap', {
                    map: map,
                    overlays: new Array(),
                    options: {}
                });
                $(this).gmap('_setMapListener');
            });
        },
        addMarker: function(options){
            if(options == undefined){
                options = {};
            }
            defaults = {
                position: null
            };
            if(options.lat && options.lng){
                options.position = _getLatLonObject(options.lat, options.lng);
                delete options.lat;
                delete options.lng;
            }
            options = $.extend(defaults, options);

            data = $(this).data('gmap');
                
            var marker = new google.maps.Marker(options);
            marker.setMap(data.map);

            data.overlays.push({
                marker: marker
            });
            data.lastPosition = {
                lat: options.position.lat(),
                lng: options.position.lng()
            };

            if(options.events){
                _processEvents(options.events, marker)
            }
                
            if(marker.infoWindow){
                defaults = {};
                options = $.extend(defaults, marker.infoWindow);
                var infowindow = new google.maps.InfoWindow(options);
                google.maps.event.addListener(marker, 'click', function() {
                    infowindow.open(data.map,marker);
                });
            }

            $(this).data('gmap', data);
            var event = jQuery.Event("addmarker");
            event.map = data.map;
            event.marker = marker;
            $(this).trigger(event);

            return marker;
        },

        addPolygon: function(options){
            if(options == undefined){
                options = {};
            }
            defaults = {
                points: [],
                events: {}
            }
            options = $.extend(defaults, options);

            //A polygon must have at least 3 points
            if(options.points.length >= 3){
                var path = [];
                for(var i = 0; i < options.points.length; i++){
                    var point = options.points[i];
                    path.push(_getLatLonObject(point.lat, point.lng));
                }
                delete options.points;

                options.paths = path;

                data = $(this).data('gmap')

                var polygon = new google.maps.Polygon(options);
                if(options.events){
                    _processEvents(options.events, polygon)
                }
                polygon.setMap(data.map);
                data.overlays.push({
                    polygon: polygon
                });
                data.lastPolygon = polygon;
                $(this).data('gmap', data);
                var event = jQuery.Event("addpolygon");
                event.map = data.map;
                event.polygon = polygon;
                $(this).trigger(event);
                return polygon;
            }
            return null;
        },

        drawPolygon: function(options){
            if(options == undefined){
                options = {};
            }
            return this.each(function(){
                var _self = $(this);
                defaults = {
                    maxPoints: 0,
                    minPoints: 3
                };
                options = $.extend(defaults, options);
                data = _self.data('gmap');
                data.options = options;
                data.listenMap = true;
                //is an edit
                if(options.polygon){
                    data.drawingPolygon = options.polygon;
                    options.polygon.getPath().forEach(function(el, i){
                        google.maps.event.trigger(data.map, 'click', {
                            latLng: el
                        });
                    })
                }
                _self.data('gmap', data);
                _self.gmap('_setMapListener');
            });
        },

        endDrawing: function(){
            var _self = $(this);
            _endDrawing(_self);
        },
        removePolygon: function(polygon){
            return this.each(function(){
                var _self = $(this);
                data = _self.data('gmap');
                $.map(data.overlays, function(el, i){
                    if(!el.polygon || el.polygon != polygon){
                        return el;
                    }
                });
                polygon.setMap(null);
                _self.data('gmap', data);
            });
        },

        removeMarker: function(marker){
            return this.each(function(){
                var _self = $(this);
                data = _self.data('gmap');
                $.map(data.overlays, function(el, i){
                    if(!el.marker || el.marker != polygon){
                        return el;
                    }
                });
                marker.setMap(null);
                _self.data('gmap', data);
            });
        },

        _unsetMapListener: function(){
            var _self = $(this);
            data = _self.data('gmap');
            google.maps.event.removeListener(data.mapListener);
            data.mapListener = null;
        },

        _setMapListener: function(){
            var _self = $(this);
            data = _self.data('gmap');
            if(!data.mapListener){
                var points = [];
                listener = google.maps.event.addListener(data.map, 'click', function(e){
                    if(!data.listenMap){
                        return;
                    }
                    ops = {
                        position: e.latLng,
                        draggable: true,
                        events: {
                            dragstart:function(evt){
                                $.map(points, function(e, i){
                                    if(e.lat == evt.latLng.lat() && e.lng == evt.latLng.lng()){
                                        window.tmpPointIndex = i;
                                    }
                                });

                            },
                            dragend: function(e){
                                points[window.tmpPointIndex] = {
                                    lat: e.latLng.lat(),
                                    lng: e.latLng.lng()
                                };
                                pol = _self.data('gmap').drawingPolygon;
                                if(pol){
                                    _self.gmap('removePolygon', pol);
                                    _drawPolygon(points, _self);
                                }
                            }
                        }
                    };
                    point = _self.gmap('addMarker', ops)
                    points.push({
                        lat:point.getPosition().lat(),
                        lng: point.getPosition().lng()
                    });
                    polygon = data.drawingPolygon;
                    if(polygon){
                        _self.gmap('removePolygon', polygon);
                    }
                    data.drawingPolygon = _drawPolygon(points, _self);
                    data.mapListener = listener;
                    _self.data('gmap', data);
                });
            }
        }
    };

    $.fn.gmap = function( method ) {

        // Method calling logic
        if ( methods[method] ) {
            return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));
        } else if ( typeof method === 'object' || ! method ) {
            return methods.init.apply( this, arguments );
        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.gmap' );
        }
    };

    function _getMapType(type){
        switch(type){
            case 'road':
                return google.maps.MapTypeId.ROADMAP
                break;
            case 'satellite':
                return google.maps.MapTypeId.SATELLITE
                break;
            case 'terrain':
                return google.maps.MapTypeId.TERRAIN
                break;
            case 'hybrid':
            default:
                return google.maps.MapTypeId.HYBRID
                break;
        }
    }

    function _getLatLonObject(lat, lon){
        return new google.maps.LatLng(lat, lon);
    }

    function _processEvents(events, overlay){
        for(var i in events){
            evt = events[i];
            google.maps.event.addListener(overlay, i, evt);
        }
    }

    function _drawPolygon(points, _self){
        data = _self.data('gmap');
        options = data.options;
        if(points.length >= options.minPoints){
            ops = {
                points: points
            };
            ops = $.extend(ops, options);
            data.drawingPolygon = _self.gmap('addPolygon', ops);
            if(points.length == options.maxPoints){
                data.listenMap = false;
            }
            _self.data('gmap', data);
            return data.drawingPolygon;
        }
        return null;
    }

    function _endDrawing(_self){
        data = _self.data('gmap');
        data.listenMap = false;
        pol = data.drawingPolygon
        pol.getPath().forEach(function(el, i){
            data.overlays = $.map(data.overlays, function(mk, ix){
                if(mk.marker){
                    var pos = mk.marker.getPosition();
                    if(pos.lat() == el.lat() && pos.lng() == el.lng()){
                        mk.marker.setMap(null);
                        return null;
                    }
                }
                return mk;
            })

        });
        data.drawingPolygon = null;
        _self.gmap('_unsetMapListener');
        _self.data('gmap', data);
        return pol;
    }

})( jQuery );
