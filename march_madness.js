(function() {

    // collect all possible outcomes and print whatever interesting things about them
    function main() {
        collectWins();
        players.sort(function(a, b) { return b.winShares - a.winShares; });
        players.forEach(printWinPercent);
        //printUpcomingGames();
        //printCommonGames();
    }

    var totalOdds = 0;
    function collectWins() {
        collectAllOutcomes(correctPicks); // add all possible outcomes to the current known outcomes
        allOutcomes.forEach(function(outcome) {
            // get the winner(s) for each outcome, and update that player's winning outcomes and win shares
            var winningPlayers = getWinners(outcome);
            var odds = getOddsForOutcome(outcome);
            totalOdds += odds;
            winningPlayers.forEach(function(winningPlayer) {
                winningPlayer.winningOutcomes.push(outcome);
                winningPlayer.winShares += (odds / winningPlayers.length); // a tie is worth a fraction of a win share
            });
        });
    }

    // calculate the probability of the given outcome
    function getOddsForOutcome(outcome) {
        var odds = 1;
        // the odds of a team winning takes into account winning all the games along the way, so only
        // factor in the odds for a team at their farthest point
        var teamsSeen = {}; // keep track of the teams we've already accounted for
        // work backwards from the champion to find teams at their furthest point
        for(var round = outcome.length - 1; round >= 2; round--) {
            for(var game = 0; game < outcome[round].length; game++) {
                var team = outcome[round][game];
                if(!teamsSeen[team]) {
                    odds *= (teamOdds[team][round - 2] / 100); // I entered odds as percents
                    teamsSeen[team] = true;
                }
            }
        }
        return odds;
    }

    var allOutcomes = [];
    function collectAllOutcomes(currentOutcome) {
        for(var round = 0; round < currentOutcome.length; round++) {
            for(var game = 0; game < currentOutcome[round].length; game++) {
                // when we find an undecided game, recurse down each possible path
                if(!currentOutcome[round][game]) {
                    // make two copies of the current outcome
                    var outcomeAsString = JSON.stringify(currentOutcome);
                    var branch1 = JSON.parse(outcomeAsString);
                    var branch2 = JSON.parse(outcomeAsString);

                    // add each team from the previous round and recurse with each branch
                    branch1[round][game] = currentOutcome[round-1][game * 2];
                    branch2[round][game] = currentOutcome[round-1][game * 2 + 1];
                    collectAllOutcomes(branch1);
                    collectAllOutcomes(branch2);
                    return;
                }
            }
        }
        // this outcome is fully complete, add it to our list
        allOutcomes.push(currentOutcome);
    }

    // get the winner(s) for a given outcome - returns a list of players since ties are possible
    function getWinners(outcome) {
        var winners = [];
        var bestScore = null;
        players.forEach(function(player) {
            var score = scorePicks(player.picks, outcome);
            if(bestScore == null || score > bestScore) { // first score or new best score
                winners = [player]; // winners is a list of just this one player
                bestScore = score;
            }
            else if(bestScore == score) { // tied, so add this player to the winners list
                winners.push(player);
            }
        });
        return winners;
    }

    // get the score for the given picks and the given outcomes
    function scorePicks(picks, outcome) {
        var roundScore = 1; // starts at one and doubles each round
        var score = 0;
        for(var round = 0; round < outcome.length; round++) {
            for(var game = 0; game < outcome[round].length; game++) {
                var winner = outcome[round][game];
                if(picks[round][game] === winner) { // correct! add the round score + the team's seed
                    score += (roundScore + teams[winner]);
                }
            }
            roundScore *= 2;
        }
        return score;
    }

    // for each game in the next incomplete round, print how each players' odds change depending on that game's outcome
    function printUpcomingGames() {
        players.forEach(function(player) {
            if (player.winningOutcomes.length == 0) {
                return;
            }

            printWinPercent(player);
            var done = false;
            for(var round = 0; round < correctPicks.length; round++) {
                for (var game = 0; game < correctPicks[round].length; game++) {
                    if (correctPicks[round][game]) {
                        continue;
                    }

                    printGameResultsForPlayer(player, round, game);
                    done = true;
                }
                if(done) return;
            }
        });
    }

    function printWinPercent(player) {
        var winPercent = ((player.winShares / totalOdds) * 100).toFixed(2);
        console.log(player.name + " wins " + winPercent + "% of outcomes (" +
                    player.winShares.toFixed(2) + " of " + totalOdds.toFixed(2) + ")");
    }

    // look at the given player's winning outcomes for the given round and game and print percentages for each outcome
    function printGameResultsForPlayer(player, round, game) {
        var team1 = correctPicks[round-1][game * 2];
        var team2 = correctPicks[round-1][game * 2 + 1];
        var team1Count = 0, team2Count = 0;
        player.winningOutcomes.forEach(function(winningOutcome) {
            if(winningOutcome[round][game] == team1) {
                team1Count++;
            }
            else if(winningOutcome[round][game] == team2) {
                team2Count++;
            }
            else {
                console.log("got " + winningOutcome[round][game] + " but expected " + team1 + " or " + team2);
            }
        });
        var team1Pct = ((team1Count / (allOutcomes.length / 2)) * 100).toFixed(2);
        var team2Pct = ((team2Count / (allOutcomes.length / 2)) * 100).toFixed(2);
        console.log(team1 + " wins: " + team1Pct + "%, " + team2 + " wins: " + team2Pct + "%");
    }

    // look at each game for each player, and find ones where there is only a single outcome in all their winning
    // outcomes. This means they're eliminated if they don't get that outcome
    function printCommonGames() {
        players.forEach(function(player) {
           if(player.winningOutcomes.length == 0) {
               return;
           }
           for(var round = 0; round < correctPicks.length; round++) {
               for(var game = 0; game < correctPicks[round].length; game++) {
                   if(correctPicks[round][game]) {
                       continue;
                   }
                   var winner = null;
                   var commonGame = true;
                   for(var i = 0; i < player.winningOutcomes.length; i++) {
                       if(winner == null) {
                           winner = player.winningOutcomes[i][round][game];
                       }
                       else if(winner != player.winningOutcomes[i][round][game]) {
                           commonGame = false;
                           break;
                       }
                   }
                   if(commonGame) {
                       console.log(player.name + " needs " + winner + " to " + roundActions[round]);
                   }
               }
           }
        });
    }

    // maps round numbers to a message to print out above
    var roundActions = [
        "win the first game",
        "get to the sweet 16",
        "get to the elite eight",
        "get to the final four",
        "get to the championship",
        "win the championship"
    ];

    //////////////////////////////////////////////////////////////////////////////
    // Below here is team and player data that was scraped from the cbs website
    //////////////////////////////////////////////////////////////////////////////

    var teams = {"Kansas":1,"Austin Peay":16,"Colorado":8,"UConn":9,"Maryland":5,"S. Dak. St.":12,"California":4,"Hawaii":13,"Arizona":6,"Wichita St.":11,"Miami (Fla.)":3,"Buffalo":14,"Iowa":7,"Temple":10,"Villanova":2,"UNC-Asheville":15,"Oregon":1,"Holy Cross":16,"Saint Joe's":8,"Cincinnati":9,"Baylor":5,"Yale":12,"Duke":4,"UNC-Wilm.":13,"Texas":6,"N. Iowa":11,"Texas A&M":3,"Green Bay":14,"Oregon St.":7,"VCU":10,"Oklahoma":2,"Cal-Baker.":15,"N. Carolina":1,"FGCU":16,"USC":8,"Providence":9,"Indiana":5,"Chattanooga":12,"Kentucky":4,"Stony Brook":13,"Notre Dame":6,"Michigan":11,"W. Virginia":3,"SF Austin":14,"Wisconsin":7,"Pittsburgh":10,"Xavier":2,"Weber St.":15,"Virginia":1,"Hampton":16,"Texas Tech":8,"Butler":9,"Purdue":5,"Little Rock":12,"Iowa St.":4,"Iona":13,"Seton Hall":6,"Gonzaga":11,"Utah":3,"Fresno St.":14,"Dayton":7,"Syracuse":10,"Michigan St.":2,"Middle Tenn.":15};

    var teamOdds = {
        "Kansas" : [73,48,33,21],
        "Maryland" : [27,12,6,3],
        "Miami (Fla.)" : [33,10,5,2],
        "Villanova" : [67,30,18,9],
        "Oregon" : [57,27,8,3],
        "Duke" : [43,19,6,3],
        "Texas A&M" : [39,19,8,4],
        "Oklahoma" : [61,35,15,7],
        "N. Carolina" : [73,59,35,19],
        "Indiana" : [27,18,8,3],
        "Notre Dame" : [50,11,4,1],
        "Wisconsin" : [50,12,4,1],
        "Virginia" : [65,43,25,13],
        "Iowa St." : [35,19,8,4],
        "Gonzaga" : [47,17,7,3],
        "Syracuse" : [53,20,8,3]
    };

    var correctPicks = [
        ["Kansas","UConn","Maryland","Hawaii","Wichita St.","Miami (Fla.)","Iowa","Villanova","Oregon","Saint Joe's","Yale","Duke","N. Iowa","Texas A&M","VCU","Oklahoma","N. Carolina","Providence","Indiana","Kentucky","Notre Dame","SF Austin","Wisconsin","Xavier","Virginia","Butler","Little Rock","Iowa St.","Gonzaga","Utah","Syracuse","Middle Tenn."],
        ["Kansas","Maryland","Miami (Fla.)","Villanova","Oregon","Duke","Texas A&M","Oklahoma","N. Carolina","Indiana","Notre Dame","Wisconsin","Virginia","Iowa St.","Gonzaga","Syracuse"],
        ["","","","","","","",""],
        ["","","",""],
        ["",""],
        [""]
    ];

    var players = [
        {
            "name": "Daniel Neems",
            "url":"http://cleanwipe.mayhem.cbssports.com/brackets/1/1",
            "winShares": 0,
            "winningOutcomes": [],
            "picks":[
                ["Kansas","UConn","Maryland","California","Wichita St.","Miami (Fla.)","Temple","Villanova","Oregon","Saint Joe's","Yale","Duke","Texas","Texas A&M","VCU","Oklahoma","N. Carolina","Providence","Indiana","Kentucky","Notre Dame","W. Virginia","Wisconsin","Xavier","Virginia","Texas Tech","Purdue","Iowa St.","Gonzaga","Utah","Dayton","Michigan St."],
                ["UConn","California","Miami (Fla.)","Temple","Oregon","Duke","Texas","Oklahoma","N. Carolina","Kentucky","W. Virginia","Xavier","Virginia","Purdue","Utah","Michigan St."],
                ["UConn","Miami (Fla.)","Duke","Oklahoma","N. Carolina","W. Virginia","Virginia","Michigan St."],
                ["Miami (Fla.)","Oklahoma","N. Carolina","Michigan St."],
                ["Miami (Fla.)","N. Carolina"],
                ["N. Carolina"]
            ]
        },
        {
            "name": "Matt Daly",
            "url":"http://cleanwipe.mayhem.cbssports.com/brackets/1/2",
            "winShares": 0,
            "winningOutcomes": [],
            "picks":[
                ["Kansas","UConn","Maryland","California","Arizona","Miami (Fla.)","Temple","Villanova","Oregon","Saint Joe's","Baylor","Duke","N. Iowa","Texas A&M","Oregon St.","Oklahoma","N. Carolina","USC","Chattanooga","Kentucky","Notre Dame","W. Virginia","Pittsburgh","Xavier","Virginia","Texas Tech","Purdue","Iowa St.","Gonzaga","Utah","Syracuse","Michigan St."],
                ["Kansas","Maryland","Arizona","Villanova","Oregon","Duke","N. Iowa","Oklahoma","N. Carolina","Kentucky","Notre Dame","Xavier","Virginia","Purdue","Utah","Michigan St."],
                ["Kansas","Villanova","Oregon","Oklahoma","N. Carolina","Xavier","Purdue","Michigan St."],
                ["Kansas","Oklahoma","N. Carolina","Michigan St."],
                ["Kansas","Michigan St."],
                ["Michigan St."]
            ]
        },
        {
            "name": "Slava Heretz",
            "url":"http://cleanwipe.mayhem.cbssports.com/brackets/1/3",
            "winShares": 0,
            "winningOutcomes": [],
            "picks":[
                ["Kansas","UConn","Maryland","California","Arizona","Miami (Fla.)","Iowa","Villanova","Oregon","Cincinnati","Baylor","Duke","Texas","Texas A&M","VCU","Oklahoma","N. Carolina","USC","Indiana","Kentucky","Notre Dame","W. Virginia","Pittsburgh","Xavier","Virginia","Butler","Purdue","Iowa St.","Gonzaga","Utah","Dayton","Michigan St."],
                ["Kansas","Maryland","Miami (Fla.)","Villanova","Oregon","Duke","Texas A&M","Oklahoma","N. Carolina","Indiana","W. Virginia","Xavier","Virginia","Purdue","Utah","Michigan St."],
                ["Kansas","Villanova","Oregon","Texas A&M","N. Carolina","W. Virginia","Virginia","Utah"],
                ["Kansas","Oregon","W. Virginia","Virginia"],
                ["Kansas","W. Virginia"],
                ["Kansas"]
            ]
        },
        {   "name": "Greg Harris",
            "url":"http://cleanwipe.mayhem.cbssports.com/brackets/1/4",
            "winShares": 0,
            "winningOutcomes": [],
            "picks":[
                ["Kansas","UConn","Maryland","California","Arizona","Miami (Fla.)","Iowa","Villanova","Oregon","Saint Joe's","Baylor","Duke","N. Iowa","Texas A&M","VCU","Oklahoma","N. Carolina","Providence","Indiana","Kentucky","Notre Dame","SF Austin","Wisconsin","Xavier","Virginia","Butler","Purdue","Iowa St.","Gonzaga","Utah","Dayton","Michigan St."],
                ["UConn","California","Arizona","Villanova","Oregon","Duke","N. Iowa","Oklahoma","Providence","Kentucky","Notre Dame","Xavier","Virginia","Iowa St.","Utah","Michigan St."],
                ["California","Villanova","Duke","Oklahoma","Kentucky","Xavier","Iowa St.","Michigan St."],
                ["Villanova","Oklahoma","Xavier","Michigan St."],
                ["Oklahoma","Michigan St."],
                ["Michigan St."]
            ]
        },
        {
            "name": "elliott linsley",
            "url":"http://cleanwipe.mayhem.cbssports.com/brackets/1/5",
            "winShares": 0,
            "winningOutcomes": [],
            "picks":[
                ["Kansas","Colorado","S. Dak. St.","California","Wichita St.","Miami (Fla.)","Iowa","Villanova","Oregon","Saint Joe's","Yale","Duke","N. Iowa","Texas A&M","VCU","Oklahoma","N. Carolina","Providence","Indiana","Kentucky","Michigan","W. Virginia","Wisconsin","Xavier","Virginia","Butler","Purdue","Iowa St.","Seton Hall","Utah","Syracuse","Michigan St."],
                ["Kansas","California","Miami (Fla.)","Villanova","Oregon","Yale","Texas A&M","Oklahoma","N. Carolina","Kentucky","W. Virginia","Xavier","Virginia","Purdue","Seton Hall","Michigan St."],
                ["Kansas","Miami (Fla.)","Oregon","Oklahoma","N. Carolina","W. Virginia","Virginia","Michigan St."],
                ["Kansas","Oklahoma","N. Carolina","Michigan St."],
                ["Kansas","Michigan St."],
                ["Kansas"]
            ]
        },
        {
            "name": "Dave Metz",
            "url":"http://cleanwipe.mayhem.cbssports.com/brackets/1/6",
            "winShares": 0,
            "winningOutcomes": [],
            "picks":[
                ["Kansas","UConn","Maryland","California","Wichita St.","Miami (Fla.)","Iowa","Villanova","Oregon","Cincinnati","Yale","Duke","Texas","Texas A&M","VCU","Oklahoma","N. Carolina","Providence","Indiana","Kentucky","Michigan","W. Virginia","Wisconsin","Xavier","Virginia","Butler","Purdue","Iowa St.","Gonzaga","Utah","Syracuse","Michigan St."],
                ["Kansas","Maryland","Miami (Fla.)","Villanova","Oregon","Yale","Texas","Oklahoma","N. Carolina","Kentucky","W. Virginia","Wisconsin","Virginia","Purdue","Gonzaga","Michigan St."],
                ["Kansas","Villanova","Yale","Oklahoma","N. Carolina","W. Virginia","Virginia","Michigan St."],
                ["Kansas","Oklahoma","N. Carolina","Michigan St."],
                ["Kansas","N. Carolina"],
                ["Kansas"]
            ]
        },
        {
            "name": "David Brown",
            "url":"http://cleanwipe.mayhem.cbssports.com/brackets/1/7",
            "winShares": 0,
            "winningOutcomes": [],
            "picks":[
                ["Kansas","UConn","Maryland","California","Arizona","Miami (Fla.)","Iowa","Villanova","Oregon","Saint Joe's","Yale","Duke","Texas","Texas A&M","Oregon St.","Oklahoma","N. Carolina","USC","Indiana","Kentucky","Notre Dame","W. Virginia","Pittsburgh","Xavier","Virginia","Texas Tech","Purdue","Iowa St.","Gonzaga","Utah","Syracuse","Michigan St."],
                ["Kansas","California","Miami (Fla.)","Villanova","Oregon","Duke","Texas A&M","Oklahoma","N. Carolina","Kentucky","Notre Dame","Xavier","Virginia","Iowa St.","Gonzaga","Michigan St."],
                ["Kansas","Villanova","Duke","Oklahoma","N. Carolina","Xavier","Virginia","Michigan St."],
                ["Kansas","Oklahoma","N. Carolina","Michigan St."],
                ["Kansas","N. Carolina"],
                ["Kansas"]
            ]
        },
        {
            "name": "Ben Hagberg",
            "url": "http://cleanwipe.mayhem.cbssports.com/brackets/1/8",
            "winShares": 0,
            "winningOutcomes": [],
            "picks":[
                ["Kansas","Colorado","S. Dak. St.","California","Wichita St.","Miami (Fla.)","Temple","Villanova","Oregon","Cincinnati","Baylor","Duke","N. Iowa","Texas A&M","VCU","Oklahoma","N. Carolina","Providence","Chattanooga","Stony Brook","Notre Dame","W. Virginia","Pittsburgh","Xavier","Virginia","Butler","Purdue","Iowa St.","Gonzaga","Fresno St.","Syracuse","Michigan St."],
                ["Kansas","California","Miami (Fla.)","Villanova","Oregon","Duke","N. Iowa","Oklahoma","N. Carolina","Chattanooga","Notre Dame","Xavier","Virginia","Purdue","Gonzaga","Michigan St."],
                ["Kansas","Miami (Fla.)","Oregon","Oklahoma","N. Carolina","Xavier","Virginia","Michigan St."],
                ["Kansas","Oregon","Xavier","Michigan St."],
                ["Kansas","Michigan St."],
                ["Kansas"]
            ]
        },
        {
            "name": "jason zopf",
            "url":"http://cleanwipe.mayhem.cbssports.com/brackets/1/9",
            "winShares": 0,
            "winningOutcomes": [],
            "picks":[
                ["Kansas","Colorado","Maryland","Hawaii","Arizona","Miami (Fla.)","Temple","Villanova","Oregon","Cincinnati","Baylor","Duke","Texas","Texas A&M","VCU","Oklahoma","N. Carolina","Providence","Chattanooga","Kentucky","Notre Dame","W. Virginia","Wisconsin","Xavier","Virginia","Butler","Purdue","Iona","Gonzaga","Utah","Dayton","Michigan St."],
                ["Kansas","Maryland","Arizona","Villanova","Oregon","Baylor","Texas","Oklahoma","N. Carolina","Kentucky","W. Virginia","Xavier","Virginia","Purdue","Utah","Michigan St."],
                ["Kansas","Arizona","Oregon","Oklahoma","N. Carolina","Xavier","Virginia","Michigan St."],
                ["Kansas","Oklahoma","N. Carolina","Michigan St."],
                ["Kansas","Michigan St."],
                ["Michigan St."]
            ]
        },
        {
            "name": "Jeff Ramsayer",
            "url":"http://cleanwipe.mayhem.cbssports.com/brackets/1/10",
            "winShares": 0,
            "winningOutcomes": [],
            "picks":[
                ["Kansas","UConn","Maryland","California","Wichita St.","Miami (Fla.)","Iowa","Villanova","Oregon","Cincinnati","Yale","Duke","Texas","Texas A&M","VCU","Oklahoma","N. Carolina","Providence","Indiana","Kentucky","Notre Dame","W. Virginia","Pittsburgh","Xavier","Virginia","Texas Tech","Purdue","Iowa St.","Gonzaga","Utah","Syracuse","Michigan St."],
                ["Kansas","California","Wichita St.","Villanova","Cincinnati","Duke","Texas A&M","Oklahoma","N. Carolina","Indiana","W. Virginia","Xavier","Virginia","Purdue","Gonzaga","Michigan St."],
                ["Kansas","Villanova","Duke","Texas A&M","N. Carolina","W. Virginia","Virginia","Michigan St."],
                ["Kansas","Texas A&M","N. Carolina","Michigan St."],
                ["Kansas","Michigan St."],
                ["Michigan St."]
            ]
        }
    ];

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Below here are functions I used on the cbs pages to scrape the above team and player data
    ////////////////////////////////////////////////////////////////////////////////////////////////

    // given an html element for a game, and a prefix ('top' or 'bottom'), get the user's pick if it was correct,
    // or the actual correct pick if it was not, or an empty string if the game hasn't been decided yet
    function getCorrectPick(el, prefix) {
        var correctPick = el.querySelector('.' + prefix + 'Team .correctPick');
        if(!correctPick) {
            correctPick = el.querySelector('.' + prefix + 'ActualCorrectPick');
        }
        return correctPick ? correctPick.innerHTML : "";
    }

    // given an html element for a game, and a prefix ('top' or 'bottom'), get the user's pick for this game
    function getPlayerPick(el, prefix) {
        return el.querySelector('.' + prefix + 'Team .teamName').innerHTML;
    }

    // cbs puts games by region, and considers the final 4 a 5th region
    var gamesPerRound = [null, 8, 4, 2, 1, 2, 1];

    // iterates over all the games in someone's bracket, applying the given function to each game div
    function getPicks(fn) {
        var picks = [];
        for(var round = 2; round <= 6; round++) { // don't care about round 1, picks start at round 2
            var roundPicks = [];
            var regions = round >= 5? [5] : [1,2,3,4]; // rounds 5 and 6 are in final 4 (region 5)
            for (var region = 0; region < regions.length; region++) {
                for(var game = 1; game <= gamesPerRound[round]; game++) {
                    var id = regions[region] + "_" + round + "_" + game; // cbs's html id format
                    var el = document.getElementById(id);
                    roundPicks.push(fn(el, "top"));
                    roundPicks.push(fn(el, "bottom"));
                }
            }
            picks.push(roundPicks);
        }
        picks.push([document.getElementById("winningTeamPick").innerHTML]);
        return picks;
    }

    // get team names mapped to their seed, needed for scoring
    function getTeams() {
        var teams = {};
        // iterate through each region and game of round 1, which includes the seed in the game div
        for(var region = 1; region <= 4; region++) {
            for(var game = 1; game <= 8; game++) {
                var id = region + "-1-" + game + "-";
                var topEl = document.getElementById(id + "Top");
                var bottomEl = document.getElementById(id + "Bottom");
                teams[topEl.getElementsByClassName('teamName')[0].innerHTML] =
                    parseInt(topEl.getElementsByClassName('seed')[0].innerHTML);
                teams[bottomEl.getElementsByClassName('teamName')[0].innerHTML] =
                    parseInt(bottomEl.getElementsByClassName('seed')[0].innerHTML);
            }
        }
        return teams;
    }

    // run the main method
    main();
})();