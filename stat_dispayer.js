(function() {

    function printOdds(pool, lookForWinners, useOdds) {

        var totalOdds = 0;
        var players = pool.players;
        var correctPicks = pool.correctPicks;
        var teams = pool.teams;
        var teamOdds = pool.teamOdds;

        // collect all possible outcomes and print whatever interesting things about them
        function printData() {
            collectWins();
            players.sort(function (a, b) {
                return b.winShares - a.winShares;
            });

            var message = "data for finishing " + (lookForWinners ? "first" : "last") +
                (useOdds? " using outcome odds from 538" : " assuming all outcomes have equal odds");
            var toDisplay = { title: message, subMessages: [] };

            var sortedOdds = { title: "players sorted by odds", messages: [] };
            players.forEach(function(player) {
                sortedOdds.messages.push(printWinPercent(player));
            });
            toDisplay.subMessages.push(sortedOdds);

            toDisplay.subMessages.push(printUpcomingGames());

            var title = (lookForWinners? "winners" : "losers" + " by game")
            toDisplay.subMessages.push({ title: (lookForWinners? "winners" : "losers") + " by game",
                                         messages: printClinchers() });

            toDisplay.subMessages.push({ title: "must have games", messages: printCommonGames() });

            resetWinData();
            return toDisplay;
        }

        function resetWinData() {
            players.forEach(function(player) {
                player.winShares = 0;
                player.winningOutcomes = [];
            });
        }

        function collectWins() {
            pool.allOutcomes.forEach(function (outcome) {
                // get the winner(s) for each outcome, and update that player's winning outcomes and win shares
                var winningPlayers = getWinners(outcome);
                var odds = getOddsForOutcome(outcome);
                totalOdds += odds;
                winningPlayers.forEach(function (winningPlayer) {
                    winningPlayer.winningOutcomes.push(outcome);
                    winningPlayer.winShares += (odds / winningPlayers.length); // a tie is worth a fraction of a win share
                });
            });
        }

        // calculate the probability of the given outcome
        function getOddsForOutcome(outcome) {
            var odds = 1;
            if (!useOdds) return odds;

            // the odds of a team winning takes into account winning all the games along the way, so only
            // factor in the odds for a team at their farthest point
            var teamsSeen = {}; // keep track of the teams we've already accounted for
            // work backwards from the champion to find teams at their furthest point
            for (var round = outcome.length - 1; round >= 2; round--) {
                for (var game = 0; game < outcome[round].length; game++) {
                    if (correctPicks[round][game]) continue;
                    var team = outcome[round][game];
                    if (!teamsSeen[team]) {
                        var regionSeedId = teams[team].id;
                        odds *= (teamOdds[regionSeedId][round + 1]);
                        teamsSeen[team] = true;
                    }
                }
            }
            return odds;
        }

        // get the winner(s) for a given outcome - returns a list of players since ties are possible
        function getWinners(outcome) {
            var winners = [];
            var bestScore = null;
            players.forEach(function (player) {
                var score = scorePicks(player.picks, outcome);
                if (scoreIsBetter(bestScore, score)) {
                    winners = [player]; // winners is a list of just this one player
                    bestScore = score;
                }
                else if (bestScore == score) { // tied, so add this player to the winners list
                    winners.push(player);
                }
            });
            return winners;
        }

        function scoreIsBetter(bestScore, score) {
            if (bestScore == null) {
                return true;
            }

            if (lookForWinners) {
                return score > bestScore;
            }
            else {
                return score < bestScore;
            }
        }

        // get the score for the given picks and the given outcomes
        function scorePicks(picks, outcome) {
            var roundScore = 1; // starts at one and doubles each round
            var score = 0;
            for (var round = 0; round < outcome.length; round++) {
                for (var game = 0; game < outcome[round].length; game++) {
                    var winner = outcome[round][game];
                    if (picks[round][game] === winner) { // correct! add the round score + the team's seed
                        score += (roundScore + teams[winner].seed);
                    }
                }
                roundScore *= 2;
            }
            return score;
        }

        // for each game in the next incomplete round, print how each players' odds change depending on that game's outcome
        function printUpcomingGames() {
            var displayUpcoming = { title: "upcoming games", subMessages: [] };
            players.forEach(function (player) {
                if (player.winningOutcomes.length == 0) {
                    return;
                }

                displayPlayerUpcoming = { title: printWinPercent(player), messages: [] };
                for (var round = 0; round < correctPicks.length; round++) {
                    for (var game = 0; game < correctPicks[round].length; game++) {
                        if (correctPicks[round][game]) {
                            continue;
                        }
                        displayPlayerUpcoming.messages =
                            displayPlayerUpcoming.messages.concat(printGameResultsForPlayer(player, round, game));
                    }
                }
                displayUpcoming.subMessages.push(displayPlayerUpcoming);
            });
            return displayUpcoming;
        }

        // prints the games that would clinch a player winning
        function printClinchers() {
            var map = initialBracket();
            for (var round = 0; round < correctPicks.length; round++) {
                for (var game = 0; game < correctPicks[round].length; game++) {
                    if (correctPicks[round][game]) {
                        continue;
                    }

                    map[round][game] = {};
                    players.forEach(function (player) {
                        player.winningOutcomes.forEach(function (winningOutcome) {
                            var teamToPlayersWithTeam = map[round][game];
                            var winner = winningOutcome[round][game];
                            if (!teamToPlayersWithTeam[winner]) {
                                teamToPlayersWithTeam[winner] = {};
                            }
                            var playerCounts = teamToPlayersWithTeam[winner];
                            if (!playerCounts[player.name]) {
                                playerCounts[player.name] = 0;
                            }
                            playerCounts[player.name]++;
                        });
                    });
                }
            }
            return printMapResults(map);
        }

        function printMapResults(map) {
            var messages = [];
            for (var round = 0; round < map.length; round++) {
                for (var game = 0; game < map[round].length; game++) {
                    if (!map[round][game]) {
                        continue;
                    }

                    var mapTeamToPlayerCounts = map[round][game];
                    for (var teamName in mapTeamToPlayerCounts) {
                        messages.push("players " + (lookForWinners ? "winning" : "losing") +
                            " when " + teamName + " " + roundActions[round]);
                        var playerCounts = mapTeamToPlayerCounts[teamName];
                        for (var player in playerCounts) {
                            messages.push("    " + player + " " + playerCounts[player] + " times");
                        }
                        messages.push("<br>");
                    }
                }
            }
            return messages;
        }

        function printWinPercent(player) {
            var winPercent = ((player.winShares / totalOdds) * 100).toFixed(2);
            if (useOdds) {
                return player.name + (lookForWinners ? " wins " : " loses ") + winPercent + "% of outcomes (" +
                    player.winningOutcomes.length + " total " + (lookForWinners ? " winning " : " losing ") + " scenarios)";
            }
            else {
                return player.name + (lookForWinners ? " wins " : " loses ") + winPercent + "% of outcomes (" +
                    player.winShares.toFixed(2) + " of " + totalOdds.toFixed(2) + ")";
            }
        }

        // look at the given player's winning outcomes for the given round and game and print percentages for each outcome
        function printGameResultsForPlayer(player, round, game) {
            var counts = {};
            var messages = [];
            player.winningOutcomes.forEach(function (winningOutcome) {
                var team = winningOutcome[round][game];
                if (!counts[team]) {
                    counts[team] = 0;
                }
                counts[team]++;
            });
            messages.push("for game " + (game+1) + " in the " + roundNames[round] + ": ");
            for (var team in counts) {
                var count = counts[team];
                var percent = ((count / player.winningOutcomes.length) * 100).toFixed(2);
                messages.push(team + " in " + percent + "% of winning outcomes (" + count + " times)<br>");
            }
            return messages;
        }

        // look at each game for each player, and find ones where there is only a single outcome in all their winning
        // outcomes. This means they're eliminated if they don't get that outcome
        function printCommonGames() {
            var messages = [];
            players.forEach(function (player) {
                if (player.winningOutcomes.length == 0) {
                    return;
                }

                for (var round = 0; round < correctPicks.length; round++) {
                    for (var game = 0; game < correctPicks[round].length; game++) {
                        if (correctPicks[round][game]) {
                            continue;
                        }
                        var winner = null;
                        var commonGame = true;
                        for (var i = 0; i < player.winningOutcomes.length; i++) {
                            if (winner == null) {
                                winner = player.winningOutcomes[i][round][game];
                            }
                            else if (winner != player.winningOutcomes[i][round][game]) {
                                commonGame = false;
                                break;
                            }
                        }
                        if (commonGame) {
                            messages.push(player.name + " is out unless " + winner + " " + roundActions[round]);
                        }
                    }
                }
            });
            return messages;
        }

        function initialBracket() {
            var noPicks = [];
            for (var round = 0; round < correctPicks.length; round++) {
                noPicks[round] = [];
                for (var game = 0; game < correctPicks[round].length; game++) {
                    noPicks[round].push("");
                }
            }
            return noPicks;
        }

        // maps round numbers to a message to print out above
        var roundActions = [
            "wins the first game",
            "gets to the sweet 16",
            "gets to the elite eight",
            "gets to the final four",
            "gets to the championship",
            "wins the championship"
        ];

        var roundNames = [
            "2nd round",
            "sweet 16",
            "elite eight",
            "final four",
            "championship"
        ];

        return printData();
    };

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Below are functions I used on the cbs pages to scrape the above team and player data
    ////////////////////////////////////////////////////////////////////////////////////////////////

    var getGamesByRound = function(regions) {
        var gamesByRound = [];
        for (var round = 0; round < 4; round++) {
            roundGames = [];
            for (var region = 0; region < 4; region++) {
                regions[region].rounds[round].games.forEach(function(game) {
                    game.region = regions[region].name.toLowerCase();
                    roundGames.push(game);
                });
            }
            gamesByRound.push(roundGames);
        }

        var final4Rounds = regions[4].rounds;
        for (var round = 0; round < final4Rounds.length; round++) {
            var roundGames = [];
            final4Rounds[round].games.forEach(function(game) {
                roundGames.push(game);
            });
            gamesByRound.push(roundGames);
        }
        return gamesByRound;
    };

    var getTeams = function(gamesByRound) {
        var teams = {};
        gamesByRound[0].forEach(function(game) { // pull the team names from the first round games
            var homeSeed = parseInt(game.home_seed);
            teams[game.home_abbr] = { seed: homeSeed , id: game.region + homeSeed, name: game.home_name };
            var awaySeed = parseInt(game.away_seed);
            teams[game.away_abbr] = { seed: awaySeed, id: game.region + awaySeed, name: game.away_name };
        });
        return teams;
    };

    var getPicks = function(gamesByRound, gameToPickFn) {
        var picks = [];
        gamesByRound.forEach(function(round) {
            roundPicks = [];
            round.forEach(function(game) {
                roundPicks.push(gameToPickFn(game));
            });
            picks.push(roundPicks);
        });
        return picks;
    };

    var correctPick = function(game) {
        return game.winner_abbr;
    };

    var playerPick = function(game) {
        return game.user_pick.pick;
    };

    var getDataAndPrintOdds = function() {
        addLogArea();
        var pool = {
            correctPicks: null,
            teams: null,
            teamOdds: null,
            allOutcomes: [],
            players: []
        };
        getOdds(pool);
    };

    var getAllPlayerData = function(pool) {
        $.get(window.location.origin + "/brackets/standings", function(response) {
            getPlayerData(1, $(response), pool);
        });
    }

    var getPlayerData = function(playerNum, $html, pool) {
        var link = $html.find('#' + playerNum + ' a');
        if (!link || !link.length) {
            logLine("analyzing possible outcomes");
            collectAllOutcomes(pool.correctPicks, pool); // add all possible outcomes to the current known outcomes

            logDisplay(printOdds(pool, true, true));
            logDisplay(printOdds(pool, true, false));
            logDisplay(printOdds(pool, false, true));
            logDisplay(printOdds(pool, false, false));
            return;
        }

        var name = link.text();
        var url = link.attr('href');
        log("getting data for " + name);
        $.get(url, function(response) {
            log(' ...parsing...');
            finishLogLine();

            var gamesByRound = getGamesFromResponse(response);
            if (!gamesByRound) {
                return;
            }

            if (!pool.teams) {
                pool.teams = getTeams(gamesByRound);
            }
            if (!pool.correctPicks) {
                pool.correctPicks = getPicks(gamesByRound, correctPick);
            }

            var playerPicks = getPicks(gamesByRound, playerPick);
            pool.players.push({
                name: name,
                picks: playerPicks,
                winShares: 0,
                winningOutcomes: []
            });
            getPlayerData(playerNum + 1, $html, pool);
        });
    };

    var getOdds = function(pool) {
        logLine("getting game odds from fivethirtyeight.com");
        $.get("https://projects.fivethirtyeight.com/march-madness-api/2018/fivethirtyeight_ncaa_forecasts.csv",
            function(response) {
                var teamOdds = {};
                var rows = response.split('\n');
                for (var i = 1; i < rows.length; i++) {
                    var cols = rows[i].split(",");
                    if (parseInt(cols[10]) === 0) { // col 10 is team_alive, 0 means false
                        break;
                    }
                    var odds = [];
                    for (var j = 3; j <= 9; j++) {
                        odds.push(parseFloat(cols[j]));
                    }
                    var regionSeedId = cols[14].toLowerCase() + parseInt(cols[15]);
                    teamOdds[regionSeedId] = odds;
                }
                pool.teamOdds = teamOdds;
                getAllPlayerData(pool);
        });
    };

    var getGamesFromResponse = function(reponse) {
        var marker = "bootstrapBracketsData = ";
        var startIndex = reponse.indexOf(marker) + marker.length;
        var endIndex = reponse.indexOf('};', startIndex) + 1;
        try {
            reponse = reponse.substring(startIndex, endIndex);
            var regions = JSON.parse(reponse).game_and_pick_list.regions;
            return getGamesByRound(regions);
        }
        catch(e) {
            logLine("couldn't parse json: " + e);
        }
    };

    function collectAllOutcomes(currentOutcome, pool) {
        for (var round = 0; round < currentOutcome.length; round++) {
            for (var game = 0; game < currentOutcome[round].length; game++) {
                // when we find an undecided game, recurse down each possible path
                if (!currentOutcome[round][game]) {
                    // make two copies of the current outcome
                    var outcomeAsString = JSON.stringify(currentOutcome);
                    var branch1 = JSON.parse(outcomeAsString);
                    var branch2 = JSON.parse(outcomeAsString);

                    // add each team from the previous round and recurse with each branch
                    branch1[round][game] = currentOutcome[round - 1][game * 2];
                    branch2[round][game] = currentOutcome[round - 1][game * 2 + 1];
                    collectAllOutcomes(branch1, pool);
                    collectAllOutcomes(branch2, pool);
                    return;
                }
            }
        }
        // this outcome is fully complete, add it to our list
        pool.allOutcomes.push(currentOutcome);
    }

    function addLogArea() {
        $("body").prepend($(`<div class="logArea" style="padding:10px;text-align:center;height:400px;overflow-y:scroll;"></div>`));
    }

    function logLine(msg) {
        msg = msg || "";
        $(".logArea").append("<div>" + msg + "</div>");
    }

    function log(msg) {
        $(".logArea").append("<span>" + msg + "</span>");
    }

    function finishLogLine() {
        $(".logArea").append("<br>");
    }

    function logDisplay(displayObj) {
        $(".logArea").append($(getHtml(displayObj)));
    }

    function getHtml(displayObj) {
        return `
            <div>
                <div style="cursor:pointer" onclick="$(this).children('.toToggle').toggle(); $(this).siblings('.toToggle').toggle();">
                    <span class="toToggle">+</span><span class="toToggle" style="display:none">-</span>
                    <span>` + displayObj.title + `</span>
                </div>
                <div class="toToggle" style="display:none">`+ getContentToToggle(displayObj) +`</div>
            </div>`;
    }

    function getContentToToggle(displayObj) {
        if (displayObj.hasOwnProperty("messages")) {
            var messages = "";
            displayObj.messages.forEach(function(message) {
                messages += ("<div>" + message + "</div>");
            });
            return messages;
        }
        else if (displayObj.hasOwnProperty("subMessages")) {
            var html = "";
            displayObj.subMessages.forEach(function(subMessage) {
                html += (getHtml(subMessage));
            });
            return html;
        }
        return "";
    }

    // do all the stuff!
    getDataAndPrintOdds();
})();
