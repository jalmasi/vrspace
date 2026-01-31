import { Avatar } from './avatar.js';
/**
 * Helper to figure out which animation to use, based on names of animation groups. 
 * Most important ones are idle and walk.
 * Used by AvatarController and BotController.
 */
export class AvatarAnimation {
  /**
   * @param {Avatar} avatar 
   */
  constructor(avatar) {
    /** @type {Avatar} */
    this.avatar = avatar;
    /** Names of all animations availalbe */
    this.animationNames = [];
    /**
     * Animation metadata, TODO extract to its own class, document all fields
     */
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
    /** Animations other than idle/walk/run */
    this.otherAnimations = [];
    /** If this is true, processText() may trigger animations */
    this.improvise = false;
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

  /** Do we know walk animation? */
  canWalk() {
    return typeof this.walk().group != 'undefined';
  }  
  
  /** @returns animation metadata object for walk, object.group is actual AnimationGroup */
  walk() {
    return this.animations.walk;
  }

  /** @returns animation metadata object for idle, object.group is actual AnimationGroup */
  idle() {
    return this.animations.idle;
  }

  /**
   * Process what user/bot said and see if there's any meaningful avatar animation to trigger.
   * @param {string} text
   * @returns babylon AnimationGroup or null
   */  
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
