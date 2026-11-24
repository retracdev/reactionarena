import reaction from './reaction.js';
import aim from './aim.js';
import typing from './typing.js';
import sequence from './sequence.js';
import clicks from './clicks.js';
import time from './time.js';
import color from './color.js';
import math from './math.js';
import precision from './precision.js';
import visual from './visual.js';

/**
 * Each game: { id, name, icon, color, category, tagline, howTo, run(ctx) }.
 * run() builds into ctx.stage and calls ctx.finish(result) when done, where result is
 * { label, value, decimals?, unit, rating, blurb?, stats?: [{ label, value }] }.
 */
export const GAMES = [reaction, aim, typing, sequence, clicks, time, color, math, precision, visual];
