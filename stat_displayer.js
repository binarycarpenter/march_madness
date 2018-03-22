(function() {

    function printOdds(pool, lookForWinners, useOdds) {

        let totalOdds = 0;
        const players = pool.players;
        const correctPicks = pool.correctPicks;
        const teams = pool.teams;
        const teamOdds = pool.teamOdds;

        // collect all possible outcomes and print whatever interesting things about them
        function printData() {
            collectWins();
            players.sort(function (a, b) {
                return b.winShares - a.winShares;
            });

            const message = "data for finishing " + (lookForWinners ? "first" : "last") +
                (useOdds? " using outcome odds from 538" : " assuming all outcomes have equal odds");
            const toDisplay = { title: message, subMessages: [] };

            const sortedOdds = { title: "players sorted by odds", messages: [] };
            players.forEach(function(player) {
                sortedOdds.messages.push(printWinPercent(player));
            });
            toDisplay.subMessages.push(sortedOdds);

            toDisplay.subMessages.push(printUpcomingGames());

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
                const winningPlayers = getWinners(outcome);
                const odds = getOddsForOutcome(outcome);
                totalOdds += odds;
                winningPlayers.forEach(function (winningPlayer) {
                    winningPlayer.winningOutcomes.push(outcome);
                    winningPlayer.winShares += (odds / winningPlayers.length); // a tie is worth a fraction of a win share
                });
            });
        }

        // calculate the probability of the given outcome
        function getOddsForOutcome(outcome) {
            let odds = 1;
            if (!useOdds) return odds;

            // the odds of a team winning takes into account winning all the games along the way, so only
            // factor in the odds for a team at their farthest point
            const teamsSeen = {}; // keep track of the teams we've already accounted for
            // work backwards from the champion to find teams at their furthest point
            for (let round = outcome.length - 1; round >= 2; round--) {
                for (let game = 0; game < outcome[round].length; game++) {
                    if (correctPicks[round][game]) continue;
                    const team = outcome[round][game];
                    if (!teamsSeen[team]) {
                        const regionSeedId = teams[team].id;
                        odds *= (teamOdds[regionSeedId][round + 1]);
                        teamsSeen[team] = true;
                    }
                }
            }
            return odds;
        }

        // get the winner(s) for a given outcome - returns a list of players since ties are possible
        function getWinners(outcome) {
            let winners = [];
            let bestScore = null;
            players.forEach(function (player) {
                const score = scorePicks(player.picks, outcome);
                if (scoreIsBetter(bestScore, score)) {
                    winners = [player]; // winners is a list of just this one player
                    bestScore = score;
                }
                else if (bestScore === score) { // tied, so add this player to the winners list
                    winners.push(player);
                }
            });
            return winners;
        }

        function scoreIsBetter(bestScore, score) {
            if (bestScore === null) {
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
            let score = 0;
            for (let round = 0; round < outcome.length; round++) {
                for (let game = 0; game < outcome[round].length; game++) {
                    const winner = outcome[round][game];
                    if (picks[round][game] === winner) { // correct! add to the score using the round's scoring function
                        score += (pool.roundScoring[round](teams[winner].seed));
                    }
                }
            }
            return score;
        }

        // for each game in the next incomplete round, print how each players' odds change depending on that game's outcome
        function printUpcomingGames() {
            const displayUpcoming = { title: "upcoming games", subMessages: [] };
            players.forEach(function (player) {
                if (player.winningOutcomes.length === 0) {
                    return;
                }

                const displayPlayerUpcoming = { title: printWinPercent(player), messages: [] };
                for (let round = 0; round < correctPicks.length; round++) {
                    for (let game = 0; game < correctPicks[round].length; game++) {
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
            const map = initialBracket();
            for (let round = 0; round < correctPicks.length; round++) {
                for (let game = 0; game < correctPicks[round].length; game++) {
                    if (correctPicks[round][game]) {
                        continue;
                    }

                    map[round][game] = {};
                    players.forEach(function (player) {
                        player.winningOutcomes.forEach(function (winningOutcome) {
                            const teamToPlayersWithTeam = map[round][game];
                            const winner = winningOutcome[round][game];
                            if (!teamToPlayersWithTeam[winner]) {
                                teamToPlayersWithTeam[winner] = {};
                            }
                            const playerCounts = teamToPlayersWithTeam[winner];
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
            const messages = [];
            for (let round = 0; round < map.length; round++) {
                for (let game = 0; game < map[round].length; game++) {
                    if (!map[round][game]) {
                        continue;
                    }

                    const mapTeamToPlayerCounts = map[round][game];
                    for (const teamName in mapTeamToPlayerCounts) {
                        messages.push("players " + (lookForWinners ? "winning" : "losing") +
                            " when " + teamName + " " + roundActions[round]);
                        const playerCounts = mapTeamToPlayerCounts[teamName];
                        for (const player in playerCounts) {
                            messages.push("    " + player + " " + playerCounts[player] + " times");
                        }
                        messages.push("<br>");
                    }
                }
            }
            return messages;
        }

        function printWinPercent(player) {
            const winPercent = ((player.winShares / totalOdds) * 100).toFixed(2);
            return player.name + (lookForWinners ? " wins " : " loses ") + winPercent + "% of the time";
        }

        // look at the given player's winning outcomes for the given round and game and print percentages for each outcome
        function printGameResultsForPlayer(player, round, game) {
            const counts = {};
            const messages = [];
            player.winningOutcomes.forEach(function (winningOutcome) {
                const team = winningOutcome[round][game];
                if (!counts[team]) {
                    counts[team] = 0;
                }
                counts[team]++;
            });
            messages.push("for game " + (game+1) + " in the " + roundNames[round] + ": ");
            for (const team in counts) {
                const count = counts[team];
                const percent = ((count / player.winningOutcomes.length) * 100).toFixed(2);
                messages.push(team + " in " + percent + "% of winning outcomes (" + count + " times)<br>");
            }
            return messages;
        }

        // look at each game for each player, and find ones where there is only a single outcome in all their winning
        // outcomes. This means they're eliminated if they don't get that outcome
        function printCommonGames() {
            const messages = [];
            players.forEach(function (player) {
                if (player.winningOutcomes.length === 0) {
                    return;
                }

                for (let round = 0; round < correctPicks.length; round++) {
                    for (let game = 0; game < correctPicks[round].length; game++) {
                        if (correctPicks[round][game]) {
                            continue;
                        }
                        let winner = null;
                        let commonGame = true;
                        for (let i = 0; i < player.winningOutcomes.length; i++) {
                            if (winner === null) {
                                winner = player.winningOutcomes[i][round][game];
                            }
                            else if (winner !== player.winningOutcomes[i][round][game]) {
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
            const noPicks = [];
            for (let round = 0; round < correctPicks.length; round++) {
                noPicks[round] = [];
                for (let game = 0; game < correctPicks[round].length; game++) {
                    noPicks[round].push("");
                }
            }
            return noPicks;
        }

        // maps round numbers to a message to print out above
        const roundActions = [
            "wins the first game",
            "gets to the sweet 16",
            "gets to the elite eight",
            "gets to the final four",
            "gets to the championship",
            "wins the championship"
        ];

        const roundNames = [
            "2nd round",
            "sweet 16",
            "elite eight",
            "final four",
            "championship"
        ];

        return printData();
    }

    ////////////////////////////////////////////////////////////////////////////////////////////////
    // Below are functions I used on the cbs pages to scrape the above team and player data
    ////////////////////////////////////////////////////////////////////////////////////////////////

    const getGamesByRound = function(regions) {
        const gamesByRound = [];
        for (let round = 0; round < 4; round++) {
            roundGames = [];
            for (let region = 0; region < 4; region++) {
                regions[region].rounds[round].games.forEach(function(game) {
                    game.region = regions[region].name.toLowerCase();
                    roundGames.push(game);
                });
            }
            gamesByRound.push(roundGames);
        }

        const final4Rounds = regions[4].rounds;
        for (let i = 0; i < final4Rounds.length; i++) {
            const roundGames = [];
            final4Rounds[i].games.forEach(function(game) {
                roundGames.push(game);
            });
            gamesByRound.push(roundGames);
        }
        return gamesByRound;
    };

    const getTeams = function(gamesByRound) {
        const teams = {};
        gamesByRound[0].forEach(function(game) { // pull the team names from the first round games
            const homeSeed = parseInt(game.home_seed);
            teams[game.home_abbr] = { seed: homeSeed , id: game.region + homeSeed, name: game.home_name };
            const awaySeed = parseInt(game.away_seed);
            teams[game.away_abbr] = { seed: awaySeed, id: game.region + awaySeed, name: game.away_name };
        });
        return teams;
    };

    const getPicks = function(gamesByRound, gameToPickFn) {
        const picks = [];
        gamesByRound.forEach(function(round) {
            const roundPicks = [];
            round.forEach(function(game) {
                roundPicks.push(gameToPickFn(game));
            });
            picks.push(roundPicks);
        });
        return picks;
    };

    const correctPick = function(game) {
        return game.winner_abbr;
    };

    const playerPick = function(game) {
        return game.user_pick.pick;
    };

    const getDataAndPrintOdds = function() {
        addLogArea();
        const pool = {
            correctPicks: null,
            teams: null,
            teamOdds: null,
            roundScoring: [],
            allOutcomes: [],
            players: []
        };
        getRules(pool);
    };

    const getRules = function(pool) {
        logLine("getting scoring rules for pool");
        $.get(window.location.origin + "/office-pool/rules", function(response) {
            const roundPoints = $(response).find(".tableRules").text().split("Each correct pick is worth ");
            for (let i = 1; i < roundPoints.length; i++) {
                const rule = roundPoints[i];
                const base = parseInt(rule);
                const addSeedBonus = rule.indexOf("added") > 0;
                // I know this option exists but I don't have an example, so this should catch [M|m]ultipl[ied|y]
                const multiplySeedBonus = rule.indexOf("ultipl") > 0;

                // each round is mapped to a function that takes the winner's seed and returns the points earned
                pool.roundScoring.push(function(seed) {
                    if (addSeedBonus) {
                        return base + seed;
                    }
                    else if (multiplySeedBonus) {
                        return base * seed;
                    }
                    return base;
                });
            }

            getOdds(pool);
        })
    };

    const getAllPlayerData = function(pool) {
        $.get(window.location.origin + "/brackets/standings", function(response) {
            const playerRows = $(response).find(".data tr[align=right] a");
            getPlayerData(0, playerRows, pool);
        });
    };

    const getPlayerData = function(playerNum, playerRows, pool) {
        if (playerNum >= playerRows.length) { // no more player data to fetch, now analyze it
            logLine("analyzing possible outcomes");
            collectAllOutcomes(pool.correctPicks, pool); // add all possible outcomes to the current known outcomes

            finishLogLine();
            finishLogLine();
            logDisplay(printOdds(pool, true, true));
            logDisplay(printOdds(pool, true, false));
            logDisplay(printOdds(pool, false, true));
            logDisplay(printOdds(pool, false, false));
            return;
        }

        const link = $(playerRows[playerNum]);
        const name = link.text();
        const url = link.attr('href');
        if (!url || !url.length) {
            logLine("no data for " + name + ", skipping...");
            return getPlayerData(playerNum + 1, playerRows, pool);
        }

        log("getting data for " + name);
        $.get(url, function(response) {
            log(' ...parsing...');
            finishLogLine();

            const gamesByRound = getGamesFromResponse(response);
            if (!gamesByRound) {
                return;
            }

            if (!pool.teams) {
                pool.teams = getTeams(gamesByRound);
            }
            if (!pool.correctPicks) {
                pool.correctPicks = getPicks(gamesByRound, correctPick);
            }

            const playerPicks = getPicks(gamesByRound, playerPick);
            pool.players.push({
                name: name,
                picks: playerPicks,
                winShares: 0,
                winningOutcomes: []
            });
            getPlayerData(playerNum + 1, playerRows, pool);
        });
    };

    const getOdds = function(pool) {
        logLine("getting game odds from 538");
        $.get("https://projects.fivethirtyeight.com/march-madness-api/2018/fivethirtyeight_ncaa_forecasts.csv",
            function(response) {
                const teamOdds = {};
                const rows = response.split('\n');
                for (let i = 1; i < rows.length; i++) {
                    const cols = rows[i].split(",");
                    if (parseInt(cols[10]) === 0) { // col 10 is team_alive, 0 means false
                        break;
                    }
                    const odds = [];
                    for (let j = 3; j <= 9; j++) {
                        odds.push(parseFloat(cols[j]));
                    }
                    const regionSeedId = cols[14].toLowerCase() + parseInt(cols[15]);
                    teamOdds[regionSeedId] = odds;
                }
                pool.teamOdds = teamOdds;
                getAllPlayerData(pool);
        });
    };

    const getGamesFromResponse = function(reponse) {
        const marker = "bootstrapBracketsData = ";
        const startIndex = reponse.indexOf(marker) + marker.length;
        const endIndex = reponse.indexOf('};', startIndex) + 1;
        try {
            reponse = reponse.substring(startIndex, endIndex);
            const regions = JSON.parse(reponse).game_and_pick_list.regions;
            return getGamesByRound(regions);
        }
        catch(e) {
            logLine("couldn't parse json: " + e);
        }
    };

    function collectAllOutcomes(currentOutcome, pool) {
        for (let round = 0; round < currentOutcome.length; round++) {
            for (let game = 0; game < currentOutcome[round].length; game++) {
                // when we find an undecided game, recurse down each possible path
                if (!currentOutcome[round][game]) {
                    // make two copies of the current outcome
                    const outcomeAsString = JSON.stringify(currentOutcome);
                    const branch1 = JSON.parse(outcomeAsString);
                    const branch2 = JSON.parse(outcomeAsString);

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
        $("body").prepend($(`
            <div class="flyout" style="padding:24px;
                                       max-height: 80%;
                                       position: fixed;
                                       background: #faebd7;
                                       top: 50%;
                                       left: 50%;
                                       transform: translate(-50%, -50%);
                                       border: 1px solid black;
                                       box-shadow: 0 10px 16px 0 rgba(0,0,0,0.5);
                                       z-index: 999999999;
                                       text-align: center;
                                       overflow-y: scroll;">
                <div style="font-size: 24px;">
                    Bracket Stats
                    <div style="float:right;font-size:24px;cursor:pointer" 
                         onclick="$(this).closest('.flyout').remove();">X</div> 
                </div>        
                <div class="logArea" style="margin-top:10px;">
                </div>
            </div>`
        ));
    }

    const indentAmount = 20;

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
        $(".logArea").append($(getHtml(displayObj, indentAmount)));
    }

    function getHtml(displayObj, indent) {
        return `
            <div style="text-align:left;">
                <div style="cursor:pointer; margin-bottom:6px; font-weight:bold;" 
                     onclick="$(this).children('.toToggle').toggle(); $(this).siblings('.toToggle').toggle();">
                    <span class="toToggle">+</span><span class="toToggle" style="display:none">-</span>
                    <span>` + displayObj.title + `</span>
                </div>
                <div class="toToggle" style="display:none; margin-left:` + indent + `px;">
                    ` + getContentToToggle(displayObj, indent) + `
                </div>
            </div>`;
    }

    function getContentToToggle(displayObj, indent) {
        if (displayObj.hasOwnProperty("messages")) {
            let messages = "";
            displayObj.messages.forEach(function(message) {
                messages += ("<div>" + message + "</div>");
            });
            messages += "<br>";
            return messages;
        }
        else if (displayObj.hasOwnProperty("subMessages")) {
            let html = "";
            displayObj.subMessages.forEach(function(subMessage) {
                html += (getHtml(subMessage, indent + indentAmount));
            });
            return html;
        }
        return "";
    }

    function printAllCurrentScores(pool) {
        pool.players.forEach(function(player) {
            let score = 0;
            const outcome = pool.correctPicks;
            const picks = player.picks;
            for (let round = 0; round < outcome.length; round++) {
                for (let game = 0; game < outcome[round].length; game++) {
                    const winner = outcome[round][game];
                    if (picks[round][game] === winner) { // correct! add to the score using the round's scoring function
                        score += (pool.roundScoring[round](pool.teams[winner].seed));
                    }
                }
            }
            console.log(player.name + " has " + score + " points");
        });
    }

    // do all the stuff!
    getDataAndPrintOdds();
})();
