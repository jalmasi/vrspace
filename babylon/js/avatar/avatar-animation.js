export class AvatarAnimation {
  constructor(avatar) {
    this.avatar = avatar;

    this.animationNames = [];

    this.animations = {
      walk: {
        substring: 'walk',
        preferredSubstring: 'place', // like 'walk_in_place'
        avoid: ['left', 'right', 'back']
      },
      walkLeft: { substring: 'walk', preferredSubstring: 'right' },
      walkRight: { substring: 'walk', preferredSubstring: 'left' },
      walkBack: { substring: 'walk', preferredSubstring: 'back' },
      idle: {
        substring: 'idle',
        useShortest: true
      },
      run: {
        substring: 'run',
        useShortest: true
      }
    }
    this.improvise = false;
    this.otherAnimations = [];
    this.processAnimations();
  }
  /**
   * Called from constructor to find walk and idle animations.
   */
  processAnimations() {
    if ( ! this.avatar.getAnimationGroups ) {
      // video avatar or mesh
      return;
    }
    this.avatar.getAnimationGroups().forEach( a => {
      this.animationNames.push(a.name)
      //console.log(a);
      var name = a.name.toLowerCase();
      for ( const ruleName in this.animations ) {
        let rule = this.animations[ruleName];
        let matches = false;
        if ( name.indexOf( rule.substring ) >= 0 ) {
          // animation matches
          if ( this.animations[ruleName].group ) {
            // animation already exists, replacement rules follow
            matches |= rule.preferredSubstring && name.indexOf(rule.preferredSubstring) >= 0;
            matches |= rule.useShortest && this.animations[ruleName].group.name.length > name.length;
          } else {
            // first match
            matches = true;
          }
          if (rule.avoid) {
            rule.avoid.forEach( word => matches &= name.indexOf(word) == -1 )
          }
        }
        if ( matches ) {
          this.animations[ruleName].group = a;
          if ( a.getLength ) {
            // babylon 6
            this.animations[ruleName].cycleDuration = a.getLength();
          } else {
            // babylon 5 or older
            this.animations[ruleName].cycleDuration = 1;
          }
        } else {
          this.otherAnimations.push(a);
        }
      }
    });
    console.log("Animations recognized: ", this.animations);
  }
  
  contains(name) {
    return this.animationNames.includes(name);
  }

  canWalk() {
    return typeof this.walk().group != 'undefined';
  }  
  
  walk() {
    return this.animations.walk;
  }

  idle() {
    return this.animations.idle;
  }
  
  processText(text) {
    if ( this.improvise ) {
      // process text and try to find some meaninful animation
      var words = text.split(' ');
      for ( var word of words ) {
        if ( word.length > 1 ) {
          var match = this.otherAnimations.find( e => e.name.includes(word.toLowerCase()));
          if ( match ) {
            return match;
          }
        }
      }
    }
    return null;
  }
    
}
