
$(document).ready(function() {
    var statsData = [];

    // Autocompletion logic
    $('#player_search').on('input', function() {
        var query = $(this).val();
        if (query.length > 1) {
            $.ajax({
                url: '/autocomplete_player',
                method: 'GET',
                data: { 'query': query },
                success: function(data) {
                    var suggestionsBox = $('#autocomplete-suggestions');
                    suggestionsBox.empty();
                    data.forEach(function(player) {
                        suggestionsBox.append($('<a>').addClass('list-group-item list-group-item-action').text(player));
                    });
                },
                error: function(xhr, status, error) {
                    console.error('Error in autocomplete:', error);
                }
            });
        } else {
            $('#autocomplete-suggestions').empty();
        }
    });

    // Player selection from suggestions
    $(document).on('click', '#autocomplete-suggestions a', function(e) {
        e.preventDefault();
        var playerName = $(this).text();
        $('#player_search').val(playerName);
        $('#autocomplete-suggestions').empty();
        loadPlayerSeasonStats(playerName);
    });

    // Loading the selected season stats
    $('#load_season').click(function() {
        var player = $('#player_search').val();
        loadPlayerSeasonStats(player);
    });

    // Load stats with the over/under line consideration
    $('#load_stats').click(function() {
        var betType = $('#bet_type').val();
        var ouLine = parseFloat($('#ou_line').val());
        var overUnderSelection = $('input[name="ou_selection"]:checked').val();

        if (!betType || isNaN(ouLine) || !overUnderSelection) {
            alert('Please select a bet type, enter an over/under line, and choose over or under.');
            return;
        }

        displayStats(statsData, betType, ouLine, overUnderSelection);
    });

    // Function to load player season stats
    function loadPlayerSeasonStats(player) {
        var season = $('#season_select').val();
        if (player && season) {
            $.ajax({
                url: '/fetch_player_stats',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ selected_player: player, selected_season: season }),
                success: function(data) {
                    statsData = data;
                    displayStats(data);
                },
                error: function(xhr, status, error) {
                    console.error('Error fetching player stats:', error);
                }
            });
        } else {
            alert('Please select a player and a season.');
        }
    }

    // Function to display stats in the table
    function displayStats(stats, betType, ouLine, overUnderSelection) {
        var statsTableBody = $('#stats_body');
        statsTableBody.empty();
        var countOverUnder = 0;

        stats.forEach(function(stat) {
            var betValue = betType ? calculateBetValue(stat, betType) : 0;
            var isOverUnder = betType ? (overUnderSelection === 'over' ? betValue > ouLine : betValue < ouLine) : false;

            if (isOverUnder) countOverUnder++;
            
            var row = $('<tr>').append(
                $('<td>').text(stat.GAME_DATE),
                $('<td>').text(stat.MATCHUP),
                $('<td>').text(stat.PTS),
                $('<td>').text(stat.AST),
                $('<td>').text(stat.REB),
                $('<td>').text(stat.STL),
                $('<td>').text(stat.BLK),
                $('<td>').text(stat.TOV),
                $('<td>').text(stat.FG3M)
            );

            if (isOverUnder) {
                row.addClass('highlight');
            }

            statsTableBody.append(row);
        });

        if (betType) {
            var resultText = `Linia ${ouLine} ${overUnderSelection} została pokryta ${countOverUnder} razy.`;
            $('#over_under_result').text(resultText).addClass('result-text');
        }
    }

    // Function to calculate the bet value
    function calculateBetValue(stat, betType) {
        if (Array.isArray(bet_type_map[betType])) {
            return bet_type_map[betType].reduce(function(sum, key) {
                return sum + (parseFloat(stat[key]) || 0);
            }, 0);
        } else {
            return parseFloat(stat[bet_type_map[betType]]) || 0;
        }
    }

    // Bet type map
    var bet_type_map = {
        "Punkty": "PTS",
        "Asysty": "AST",
        "Zbiórki": "REB",
        "Przechwyty": "STL",
        "Bloki": "BLK",
        "Straty": "TOV",
        "Trafione za 3": "FG3M",
        "Punkty i asysty": ["PTS", "AST"],
        "Punkty i zbiórki": ["PTS", "REB"],
        "Punkty, asysty i zbiórki": ["PTS", "AST", "REB"],
    };
});
