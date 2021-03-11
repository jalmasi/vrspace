var min;
var max;
var distance;
var current = {};
function between( from, to ) {
  return Math.random() * (to - from) + from;  
}
/*
Post message like this:
randomizer.postMessage(
  {
    interval: {min: 200, max:1000},
    min:{x:-3,y:0,z:-5},
    max:{x:7,y:2,z:2},
    distance: {min: 0, max: 1}
  }
);
Consume random event like:
var randomizer = new Worker('/babylon/randomizer.js');
randomizer.addEventListener('message', (e) => {
  var changes = {position: e.data};
  worldManager.VRSPACE.processEvent( {Client:obj.id}, changes );
  // OR this:
  Object.assign(obj,changes);
  obj.notifyListeners(changes);
}, false);
*/
onmessage = (e) => {
  console.log(e.data);
  property = e.data.property;
  min = e.data.min;
  max = e.data.max;
  distance = e.data.distance;
  interval = e.data.interval;
  for ( var property in min ) {
    current[property] = (max[property] - min[property])/2; 
  }
  setInterval(() => {
    for ( var property in min ) {
      var delta = between( distance.min, distance.max );
      if ( Math.random() < 0.5 ) {
        delta = - delta;
      }
      var value = current[property] + delta;
      value = Math.max( min[property], value);      
      value = Math.min( max[property], value);
      current[property] = value      
    };
    postMessage(current)
  }, between(interval.min, interval.max))
}