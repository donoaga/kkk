/*
Crossword gmae
Sam Fisk 20161208 copytacos and no-one allowed to use code. :3
Version 0.0.1

Base game:
- Presented with grid (of varying sizes; 5-8+, square), full of letters.
- Letters are answers to crossword-style clues.
- Difficulties:
  + Easy: Clues in order and with lengths.
  + Normal: Clues are presented in order. No lengths.
  + Hard: Get all clues, shuffled, at once. No lengths.
- Trace out the solution (drag) once found. Correct answers will delete the tiles.
  All above tiles fall to fill the space.
- Because of duplicate letters it will be possible to incorrectly select the correct
  answer. Thus when successfully selecting a solution it is added next to clue, and
  can rewind state by tapping clues or restart to return to start.

Impl. details:
- Answers in SHA1 hashes to make it nigh impossible to cheat. Hard-mode shuffle
  in fetched-master so impossible to tell original order (have to listen to calls
  to cheat then.. way beyond worth).
- Small ad in order for monetising + polite request not to block.
- Need to write:
  + Grid constructing algorithm from a set of clues (presumably backwards).
  + Tool to aid in constructing crosswords (since will have to manually compose).
  + Backend and user stuff and stats tracking etc.

Extras:
- Expose composer to users and allow them to share via complex hash code or actually just store it.
  + Maybe allow people to submit for review and acceptance.

Ideas / Issues:
- Very hard so might need way to rule out or mark letters. Buttons to enable easy highlighting?

Todo:

0.0.2:
- Add stuff that will be on page later, so little redesign needed:
  + Rewind buttons to clues + overall.
  + Maybe: Highlighting mode.
- Rework styling, including to be responsive.
  + Grid will need to be dynamic so either change positioning system to %s or have the entire thing recalculate on resize event (probably viable but messy as fuck; maybe use state-restore to cheat).
- Test+amend touch controls.
  + Will likely need to allow for going too close to corners. Could just round-off the tiles more.

0.0.?:
- Add state restoration/saving.

0.0.?:
- Decide on a name!
- Move to local, use Git, split up classes, setup Grunt tasks, and place to be on gmaemoose.co.uk.

Onwards (most points could be a whole minor version):
- Add difficulties.
  + Including 
- Maybe: Add highlighting mode.
- Write algorithm to generate grid from answers.
- Devise backend and any necessary login+saving tacos.
  + Add necessary front-page/nav/etc.
- Write tool to help with composing of things:
  + Counts letters used.
  + Reorderable clues.
  + Preview board.

*/


// Test a word.
function tryWord(puzzle, word, onlyCheckFirst) {
  if ( typeof word != 'string' ) {
    return false;
  }
  // Hash word.
  var wordHash = ''+CryptoJS.SHA1(word.toUpperCase());
  // Iterate clues.
  var length = onlyCheckFirst === true ? 1 : puzzle.clues.length;
  for ( var clueI = 0; clueI < length; clueI++ ) {
    var clue = puzzle.clues[clueI],
        clueHash = clue.hash;
    if ( clueHash === wordHash ) {
      return {
        clueNumber: clueI,
        clue: clue
      }
    }
  }
  return false;
};

// GRID CLASS
// Manages the grid.
function Grid(puzzle) {
  // Dom references.
  this.$grid = $('.game-grid');
  this.$clues = $('.clues');
  this.$id = $('#puzzleId');
  this.$author = $('#author');
  // Constants.
  this.gridPadding = 2;
  this.cellMargin = 1;
  // Gogogogo.
  this.cleanUp();
  this.setup(puzzle);
}

// Clean up stuff added in setup (done before to ensure clean slate).
Grid.prototype.cleanUp = function() {
  // Clear existing cells.
  this.$grid.empty();
  // Clear clues.
  this.$clues.empty();
  // Clear author name.
  this.$author.text('');
};

// Construct grid whilst saving parts as members of Grid for convenient access.
Grid.prototype.setup = function(puzzle) {
  console.log('Starting puzzle #'+puzzle.id); // Just for making it a bit clearer in console when I hit go.
  this.puzzle = puzzle;
  // Start building array for tracking letters neatly (column-centric so easy to make letters fall).
  this.columns = Array(puzzle.width);
  // Select class for sizing cells, and offset for positioning cells.
  var cellClasses = 'cell cell' + puzzle.width;
  this.cellSize = ((100-(2*this.gridPadding)) / puzzle.width) - (2*this.cellMargin);
  // Create cells.
  var rows = puzzle.letters.split('/');
  // Iterate rows.
  for ( var iY = 0; iY < rows.length; iY++ ) {
    var row = rows[iY],
        cols = row.split(''),
        y = this.puzzle.height-iY-1;
    // Iterate columns.
    for ( var x = 0; x < cols.length; x++ ) {
      // Creating the cell.
      var letter = cols[x],
          cell = $('<div/>',{class:cellClasses}),
          cellInner = $('<div/>',{class:'vam'});
      cellInner.text(letter);
      cellInner.appendTo(cell);
      // Positioning it.
      var xPos = this.gridPadding + (x * (this.cellSize+2*this.cellMargin)),
          yPos = this.gridPadding + (y * (this.cellSize+2*this.cellMargin));
      cell.css('left',''+xPos+'%');
      cell.css('bottom',''+yPos+'%');
      // Storing position data for trace tracking.
      cell.data('x',x);
      cell.data('y',y);
      // Appending to grid.
      cell.appendTo(this.$grid);
      // And appending to columns for tracking/processing.
      if ( this.columns[x] === undefined ) {
        this.columns[x] = [];
      }
      this.columns[x].unshift({
        letter: letter,
        x: x, y: y,
        $el: cell
      });
    }
  }
  // Insert clues.
  this.clues = [];
  for ( var clueI = 0; clueI < puzzle.clues.length; clueI++ ) {
    var clue = puzzle.clues[clueI],
        $clue = $('<li/>',{class:'clue'});
    $clue.text(clue.clue);
    this.clues.push({
      clue: clue,
      $el: $clue
    });
    $clue.appendTo(this.$clues);
  }
  // Insert puzzle ID and author name.
  this.$id.text(puzzle.id);
  this.$author.text(puzzle.author);
};

// Deletes a word (defined by specific letters) and invokes animation.
Grid.prototype.deleteWord = function(word, coords, clue) {
  // Reveal the answer in case of restart/rewind.
  clue.revealedAnswer = word;
  // Used to inform startFallAnimations about which need to fall.
  var colsDroppingAt = Array(this.puzzle.width).fill(this.puzzle.height),
  // Iterate letter coords...
      coordsLength = coords.length;
  for ( var i = 0; i < coordsLength; i++ ) {
    var coord = coords[i],
        x = coord.x, y = coord.y,
        cell = this.columns[x][y];
    // Update that this col needs to drop.
    if ( y < colsDroppingAt[x] ) {
      colsDroppingAt[x] = y;
    }
    // Kill the cell.
    cell.$el.remove();
    this.columns[x][y].remove = true; // Mark for deletion (coords will be ruined by doing it now).
  }
  // Safely delete cell references.
  for ( var x = 0; x < this.columns.length; x++ ) {
    var column = this.columns[x];
    for ( var y = 0; y < column.length; ) {
      var cell = column[y];
      if ( cell.remove === true ) {
        column.splice(y,1);
      } else {
        y++;
      }
    }
  }
  // Calculate and trigger animations.
  //console.log(colsDroppingAt);
  this.startFallAnimations(colsDroppingAt);
  // Mark the appropriate clue as done.
  var cluesLength = this.clues.length;
  for ( var i = 0; i < cluesLength; i++ ) {
    var cluePair = this.clues[i];
    var $clue = cluePair.$el;
    if ( cluePair.clue === clue.clue ) {
      $clue.addClass('clue-answered');
      $clue.html($clue.text()+' <i>'+word+'</i>');
      break;
    }
  }
};

// Iterates every cell looking for ones that can drop, setting up animations.
Grid.prototype.startFallAnimations = function(startDroppingAt) {
  // Iterate over this.columns.
  for ( var x = 0; x < this.columns.length; x++ ) {
    // Iterate up column, starting at element in startDroppingAt (can skip if -1).
    var start = startDroppingAt[x];
    if ( start < this.puzzle.height ) {
      var column = this.columns[x];
      for ( var y = start; y < column.length; y++ ) {
        // If each item does not have y coord matching index in array:
        var cell = column[y],
            oldY = cell.y;
        if ( oldY !== y ) {
          // Trigger drop.
          var yPos = this.gridPadding + ((this.puzzle.height-y-1) * (this.cellSize+2*this.cellMargin));
          //cell.$el.css('top',''+yPos+'%');
          // Animate the fall.
          cell.$el.animate({top: yPos+'%'},{
            duration: 200 * (oldY - y),
            easing: 'linear'
          });
          // Update cell position.
          cell.y = y;
          cell.$el.data('y',y);
        }
      }
    }
  }
};

// SELECTION HANDLER CLASS
// Handle click/touch drag selection on grid.
function SelectionHandler(grid) {
  this.grid = grid;
  this.setupEvents();
  this._debugEvents = true;
}
var mobile = (/iphone|ipad|ipod|android|blackberry|mini|windows\sce|palm/i
  .test(navigator.userAgent.toLowerCase()));
// Sets up events for mouse/touch down/up/move.
SelectionHandler.prototype.setupEvents = function() {
  // Disable touch shit.
  //var preventDefault = function(e) { e.preventDefault(); }
  //$('html','body').on('touchstart touchmove',preventDefault);
  //$('body').parent().on('touchstart touchmove',preventDefault);
  // Need to use document or body/etc because mouse event (like up) can be dropped when not inside grid.
  if(!(mobile)) {
    $('#gameGrid').on('mousedown',_.bind(this.down,this,false));
    $('#gameGrid').on('mousemove',_.bind(this.move,this,false));
    $('#gameGrid').on('mouseup',_.bind(this.up,this,false));
  } else {
    $('#gameGrid').on("vmousedown touchstart",_.bind(this.down,this,false));
    $('#gameGrid').on("touchmove",_.bind(this.move,this,false));
    $('#gameGrid').on("vmouseup touchend",_.bind(this.up,this,false));
    // $('#gameGrid .cell').on('touchover',_.bind(this.down,this,false));
  }
  
};

// Unsets the events setup by this class.
SelectionHandler.prototype.unsetupEvents = function() {
  $(document).off();
};

// Used by both down and move callbacks; returns the 'cell' object from target property of the event.
SelectionHandler.prototype._pickCellFromEvent = function(event) {
  var closest = $(event.target).closest('.cell',this.grid.$grid);
  if ( closest.length === 0 ) {
    return undefined;
  }
  return closest;
};

// Callback when mouse/touch down event is fired. Begins tracking movement over grid, beginning with selecting a letter.
SelectionHandler.prototype.down = function(isTouch, event) {
  // Give up if not left mouse button.
  if ( !mobile ) {
    if ( event.button !== 0 ) {
      return;
    }
  }
  // Some useful debug info.
  if ( this._debugEvents ) {
    console.log((isTouch?'touch':'mouse')+' down:');
    console.log(event+"down");
  }
  // Stop handling events normally (particularly important for touch).
  event.preventDefault();
  // Register tracking started.
  this.isDown = true;
  // Attempt to pick a cell.
  var cell = this._pickCellFromEvent(event);
  if ( cell === undefined ) {
    return;
  }
  // Apply :hover-like class to selected cell.
  cell.addClass('trace');
  // Tracking used to tell if selection has already happened for a cell; mainly used in move().
  this.currentCell = cell;
  // Start the trace.
  this.trace = [cell];
};

// Callback when mouse/touch move event is fired. Tracks movement over grid and letter selection.
SelectionHandler.prototype.move = function(isTouch, event) {
  // Give up if handler has not already started tracking.
  if ( !this.isDown ) {
    return;
  }
  // Some useful debug info.
  if ( this._debugEvents ) {
    console.log((isTouch?'touch':'mouse')+' move:');
    console.log(event+"move");
  }
  // Stop handling events normally (particularly important for touch).
  event.preventDefault();
  // Hack to allow people to not click on a cell initially.
  if ( this.trace === undefined ) {
    this.trace = [];
  }
  // Attempt to pick a cell.
  // Only activate adding to trace if not presently already inside a cell.
  var cell = this._pickCellFromEvent(event);
  // Give up if not there.
  if ( cell === undefined ) {
    this.currentCell = undefined;
    return;
  }
  // Give up if haven't left current cell.
  if(!mobile) {
    if ( cell.is(this.currentCell) ) {
      return;
    }
  }
  // Undo trace if reentering cell that was the last to be selected, removing it from list and removing hover class.
  var traceLength = this.trace.length;
  if ( traceLength > 1 ) { // Don't bother with check if it's first cell.
    var cellBeforeLast = this.trace[traceLength-2];
    if ( cell.is(cellBeforeLast) ) {
      this.trace.pop().removeClass('trace');
      return;
    }
  }
  // Ensure cell has not already been selected (just ignore rather than destroying list).
  if(!mobile) {
    var traceContainsCell = this.trace.some(function(v) { return v.is(cell); });
    if ( traceContainsCell ) {
      return;
    }
  }
  // Tracking used to tell if selection has already happened for a cell.
  this.currentCell = cell;
  // Check cell is adjacent/diagonal to previous cell. This can go after this.currentCell assignment as it is only used to prevent excessive processing, and thus is especially useful when failing on a check this late.
  if ( traceLength >= 1 ) { // Don't bother with check if it's first cell.
    var previousCell = this.trace[traceLength-1],
        pX = previousCell.data('x'), pY = previousCell.data('y'),
        x = cell.data('x'), y = cell.data('y');
    if ( !(Math.abs(pX-x) <= 1 && Math.abs(pY-y) <= 1) ) {
      return;
    }
  }
  // Apply :hover-like class to selected cell.
  cell.addClass('trace');
  this.trace.push(cell);
};

// Callback when mouse/touch up event is fired. Finishes tracking and tests word against the puzzle.
SelectionHandler.prototype.up = function(isTouch, event) {
  // Give up if not left mouse button.
  if (!mobile) {
    if ( event.button !== 0 ) {
      return;
    }
  }
  // Some useful debug info.
  if ( this.debugEvents ) {
    console.log((isTouch?'touch':'mouse')+' up:');
    console.log(event+"up");
  }
  // Stop handling events normally (particularly important for touch).
  event.preventDefault();
  // Give up if nothing to process.
  if ( this.trace === undefined ) {
    this.isDown = false;
    return;
  }
  // Reconstructing the trace.
  //console.log(this.trace);
  var word = '', coords = [], traceLength = this.trace.length;
  for ( var i = 0; i < traceLength; i++ ) {
    var cell = this.trace[i];
    word += cell.text();
    coords.push({ x: cell.data('x'), y: cell.data('y') });
  }
  //console.log(word); console.log(coords);
  // If word check fails, remove .trace.
  var clue = tryWord(this.grid.puzzle,word);
  if ( !clue ) {
    while ( this.trace.length > 0 ) {
      this.trace.pop().removeClass('trace');
    }
  }
  // Otherwise, fire grid method to remove the word.
  else {
    console.log('Word success!!',word);
    this.grid.deleteWord(word,coords,clue);

    //CALL THE FINAL FUNCTION (IF ALL WORDS WAS GUESSED)
    if (this.grid.puzzle.words.length === 0) {
      FinalFunction();
    }
  }
  if (event.type == 'touchend') {
    cell.removeClass('trace');
  } else {
    cell.removeClass('trace');
  }
  // Register tracking ended.
  this.isDown = false;
  this.trace = undefined;
  console.log(word);
};

//RADU
// Lazy pre-declare (not strictly needed).
var puzzles;

// ENTRY POINT.
$(document).ready(function() {
  var grid = new Grid(puzzles[0]);
  var sh = new SelectionHandler(grid);
  /* tryWord tests
  console.log(tryWord(puzzles[0],'tacos'));
  console.log(tryWord(puzzles[0],'tacos',true));
  console.log(tryWord(puzzles[0],'cat'));
  console.log(tryWord(puzzles[0],'cat',true));
  console.log(tryWord(puzzles[0],'altering'));*/
});

function FinalFunction() {
    console.log("there is the final function \n not word yet");
}

// Preset puzzles (to be removed).
 puzzles = [
  {
    id: 1, author: 'Sam', width: 8, height: 8,
    letters: 'FEVSALIN/TUSERMTE/LATORORC/ESACIISI/EANTSTGN/NETUREAE/NRAERPXC/RTWBITOE',
    clues: [
      { clue: 'Feline.', length: 3, hash: 'cf9b775c2c444520178d30c267440066c6eff6e8' },
      { clue: 'A liquid.', length: 5, hash: 'f4a1a28697eb860517e499d710314e4ddfaf099b' },
    ]
  }
];

