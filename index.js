var suspend = require('suspend');
var request = require('sync-request');
var readline = require('readline');
var linereader = require('line-by-line');
var corrections = require('./corrections.json');
var colors = require('colors');
var _ = require('underscore');

var apiKey = '159b51ec530d7b833c91c12cbea66981';
var baseUrl = 'https://api.themoviedb.org/3/';

// Matches like
// 8/1/16	Bob's Burgers: Season 3: "Mutiny on the Windbreaker"	Report a problem	×
// 7/2/14	Attack on Titan: "To You, After 2,000 Years: The Fall of Shiganshina, Part 1"	Report a problem	×
var tvSeriesRegex = /[0-9].+[0-9]\t(.+:(.+:)? ".+")\t.*/;

// Matches like
// 7/26/16	Samsara	Report a problem	×
var movieRegex = /[0-9].+[0-9]\t(.+)\t.*\t.*/;

// To avoid having to hit the API for ever single item, we'll cache runtimes
// using either the series name or movie title as a key
var tvRuntimeCache = {};
var movieRuntimeCache = {};

// Track which medias couldn't find a match from the API
var failedTv = [];
var failedMovies = [];

var totalLineCount = 0;
var validLineCount = 0;
var totalRuntime = 0;

var movielinereader = new linereader('data.txt');
movielinereader.on('line', function(line) {
  // Allow commenting out lines for debugging
  if (line.indexOf('//') == 0) {
    return;
  }

  if (line.match(tvSeriesRegex)) {
    // We found a TV show!
    totalLineCount++;

    // Extract the title
    var episodeInfoString = tvSeriesRegex.exec(line)[1];
    var titleRegex = /([^:]+):( .+:)? ".+"$/;
    var seriesTitle = titleRegex.exec(episodeInfoString)[1];
    updateProgressLine(seriesTitle)

    // Attempt to correct if needed
    if (corrections.tv[seriesTitle]) {
      console.log('correcting ' + seriesTitle + ' to ' + corrections.tv[seriesTitle]);
      seriesTitle = corrections.tv[seriesTitle];
    }

    // Check cache for series
    if (tvRuntimeCache[seriesTitle] != undefined) {
      totalRuntime += tvRuntimeCache[seriesTitle];
      validLineCount++;
      return;
    }

    // Try to get series ID from the series' name
    var response = getJsonResponse(request('GET', getUrlForSeriesSearch(seriesTitle)));
    if (response.results.length > 0) {
      // We have a match!
      // Sort the results by popularity and grab the ID from the most popular one
      var seriesId = _.last(_.sortBy(response.results, series => series.popularity)).id;
    } else {
      // No series found. Onwards!
      failedTv.push(seriesTitle + ' [no match from TMDb]');
      return;
    }

    // Get TV series info
    var response = getJsonResponse(request('GET', getUrlForSeriesInfo(seriesId)));
    if (!response.episode_run_time) {
      // Series doesn't have a runtime listed
      failedTv.push(seriesTitle + ' [no runtime data]');
      return;
    }
    var episodeRuntime = response.episode_run_time[0];

    // Sum and cache runtime
    tvRuntimeCache[seriesTitle] = episodeRuntime;
    totalRuntime += episodeRuntime;
    validLineCount++;

    // Rate-limit ourselves
    wait(500);
  } else if (line.match(movieRegex)) {
    // Assume it is a movie
    totalLineCount++;

    // Extract the title
    var movieTitle = movieRegex.exec(line)[1];

    // Attempt to correct if needed
    if (corrections.movies[movieTitle]) {
      console.log('correcting ' + movieTitle + ' to ' + corrections.movies[movieTitle]);
      movieTitle = corrections.movies[movieTitle];
    }

    // Check cache for movie
    if (movieRuntimeCache[movieTitle] != undefined) {
      totalRuntime += movieRuntimeCache[movieTitle];
      validLineCount++;
      return;
    }

    // Try to find movie ID
    var response = getJsonResponse(request('GET', getUrlForMovieSerch(movieTitle)));
    if (response.results.length > 0) {
      // We have a match!
      // Sort the results by popularity and grab the ID from the most popular one
      var movieId = _.last(_.sortBy(response.results, movie => movie.popularity)).id;
    } else {
      // No movie found. Onwards!
      failedMovies.push(movieTitle + ' [no match from TMDb]');
      return;
    }

    // Get movie info
    var response = getJsonResponse(request('GET', getUrlForMovieInfo(movieId)));
    if (!response.runtime) {
      // Movie doesn't have a defined runtime
      failedMovies.push(movieTitle + ` [no runtime data]`);
      return;
    }
    var runtime = response.runtime;

    // Sum and cache runtime
    movieRuntimeCache[movieTitle] = runtime;
    totalRuntime += runtime;
    validLineCount++;

    // Rate-limit ourselves
    wait(500);
  } else {
    // Line isn't valid. Onwards!
    return;
  }
});

var wait = function(duration) {
  suspend(function*() {
    yield setTimeout(suspend.resume(), duration);
  })();
}

movielinereader.on('end', function() {
  readline.clearLine(process.stdout);
  readline.cursorTo(process.stdout, 0);
  console.log(`Total runtime: ${totalRuntime} minutes`);
  console.log(`This is equivalent to ${(totalRuntime / 60).toFixed(2)} hours, or ${(totalRuntime / (60 * 24)).toFixed(2)} days.`);
  console.log();
  console.log(`A total of ${totalLineCount} items were processed`)
  console.log(`Of those, ${validLineCount} were found on TMDb and had runtime data.`);
  console.log();
  if (failedTv.length > 0) {
    console.log('Failed TV Shows:')
    _.each(failedTv, title => console.log('- ' + title));
  }
  if (failedMovies.length > 0) {
    console.log('Failed Movies:')
    _.each(failedMovies, title => console.log('- ' + title));
  }
});

var updateProgressLine = function(title) {
  readline.clearLine(process.stdout)
  readline.cursorTo(process.stdout, 0)
  process.stdout.write('Processing: '.green + title);
}

function getJsonResponse(res) {
  return JSON.parse(res.getBody('utf8'));
}

function getUrlForSeriesSearch(title) {
  return baseUrl + 'search/tv?api_key=' + apiKey + "&query=" + encodeURIComponent(title);
}

function getUrlForSeriesInfo(seriesId) {
  return baseUrl + 'tv/' + seriesId + '?api_key=' + apiKey;
}

function getUrlForMovieSerch(title) {
  return baseUrl + 'search/movie?api_key=' + apiKey + "&query=" + encodeURIComponent(title);
}

function getUrlForMovieInfo(movieId) {
  return baseUrl + 'movie/' + movieId + "?api_key=" + apiKey;
}
