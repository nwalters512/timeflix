# timeflix

A Node.js console app that aims to provide a rough estimate of how much Netflix you've watched in your life.

## Usage

The following **must** be done using Chrome; timeflix relies on how it writes copied data to the system clipboard.

1. Install [Node.js](https://nodejs.org/en/download/).
1. Clone this project to your computer (duh).
1. In your terminal, navigate to the root of this project and `npm install` to install the required dependencies.
1. Navigate to [https://www.netflix.com/viewingactivity](https://www.netflix.com/viewingactivity), where Netflix lets you see your viewing history. The page is implemented with infinite scrolling; to ensure that your entire history is loaded, repeatedly scroll to the bottom of the page until new rows stop being loaded. The easiest way to do this is to just hold down `End` on your keyboard.
1. Select the entire table. In Chrome, this can be accomplished by positioning your mouse to the left of the first row, clicking, and dragging across the first row. If you do this correctly, the whole table should highlight. Otherwise, you'll have to select the whole thing by dragging down the whole page. But then again, if you're reading this, you probably know how text selection works. Onwards.
1. Copy and paste the whole thing into a text file in the root of this project's directory called `data.txt`. Make sure you use a text editor that maintains special whitespace characters (read: tabs). Yeah, that means Windows Notepad probably won't work.
1. In your terminal, navigate to the root of this project and `npm start`.
1. While you wait, start crying; you already know the result is going to be too high.

#### Advanced features

Sometimes, the names used for a series or movie can differ between Netflix and TMDb, which can result in failed matches. An example of this is The Office. Netflix knows it as **The Office (U.S.)**, whereas on TMDb it's called simply **The Office**. If you want to manually correct for this, you can include mappings from the Netflix title to the TMDb title in the `corrections.json` file. An example for The Office has been included already.

## Ideas for improvement

* Write a browser extension to automate the scraping of data from Netflix
* Better yet, stick all the functionality of this program in a browser extension
* Add command prompt arguments for things like the name of the data file
* Expand parser to be able to handle copy/paste data from other browsers (for instance, when copying data to the clipboard, Firefox places each "cell" of data on its own line)
* Expand corrections feature to be able to correct runtimes
* Find a way to share more code between the movie and TV handling; most of the code is very similar

## How it works

### High-level overview

Using regex magic, timeflix determines if each line of your viewing history represents a TV show or movie and then extracts its title. The [TMBd API](https://www.themoviedb.org/documentation/api) is queried for that title; if a match is found, we use another API call to get its runtime and add it to a running sum.

### The nitty-gritty

Netflix [shut down their public API](https://techcrunch.com/2014/11/16/netflix-api/) in 2014, so getting your viewing history is somewhat convoluted. Netflix provides a limited set of data on [https://www.netflix.com/viewingactivity](https://www.netflix.com/viewingactivity) that includes the title (and season/episode) of each thing that you've ever watched on Netflix. This doesn't include data like how much of each thing you've actually watched, which could lead to us overestimating how much Netflix you've watched. For instance, if you watch the first 20 minutes of a movie and then decide you don't like it, it will still show up in your viewing history, so timeflix will naively assume you've watched the whole thing.

When copying and pasting the table from Chrome (I didn't test on other browsers), each line looks, generally speaking, like one of the following:

> 7/2/14→Attack on Titan: "To You, After 2,000 Years: The Fall of Shiganshina, Part 1"→Report a problem→×
>
> 6/30/14→American Dad!: Season 2: "American Dream Factory"→Report a problem→×
>
> 4/19/14→Mean Girls→Report a problem→×

Note that `→` represents a tab character. From these examples, we can write three "formal" patterns that a line will follow.

For a TV show with named seasons:

```
[date][tab][series name]: [season name]: "[episode name]"[tab]Report this problem[tab]x
```

For a TV show with no season provided:
```
[date][tab][series name]: "[episode name]"[tab]Report this problem[tab]x
```

For a movie:
```
[date][tab][movie name][tab]Report this problem[tab]x
```

From this, we can write some regex to extract the series name or movie title from each line. Care must be taken with the semicolons. For instance, some movies may contain them in the title; it's important that we don't accidentally think one of those movies is a TV show. See the source code for the exact regular expressions that I used.

Now that we have the titles of each movie/series, we need to get runtimes for each one. For that, we use the [TMDb API](https://www.themoviedb.org/documentation/api). First, using their search API, we attempt to map the title of each item to an entity in their database; from this, we can get an ID representing that entity. Then, we use their TV or Movie APIs to get the details for that entity, which include runtimes. TMDb doesn't list runtimes for individual episodes. Instead, it provides an array of all runtimes that any episode has had in the past. We use the smallest one to avoid excessive overestimation. This should work because generally, longer episodes would be unusually long holidy specials or something of the like.

Now that we have runtimes for each entity, determining the total runtime is just a simple matter of summing all the individual runtimes. Ta-da, now you know how much you should hate yourself!
