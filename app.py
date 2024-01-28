from flask import Flask, render_template, request, jsonify, redirect, url_for
from nba_api.stats.static import players
from nba_api.stats.endpoints import playergamelog
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Replace with your own secret key
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'  # SQLite database configuration

# Create a dictionary of players at the start
player_dict = {player["full_name"]: player for player in players.get_active_players()}

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)

# Initialize SQLAlchemy database
db = SQLAlchemy(app)

# User model for Flask-Login
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/')
def home():
    if current_user.is_authenticated:
        return render_template("index.html")
    else:
        return redirect(url_for('login'))

@app.route('/autocomplete_player', methods=['GET'])
def autocomplete_player():
    query = request.args.get('query', '')
    matching_players = [player for player in player_dict if player.lower().startswith(query.lower())]
    return jsonify(matching_players)

@app.route("/fetch_player_stats", methods=["POST"])
@login_required
def fetch_player_stats():
    data = request.get_json()
    selected_player = data["selected_player"]
    selected_season = data["selected_season"]

    try:
        if selected_player in player_dict:
            player_id = player_dict[selected_player]["id"]
        else:
            raise ValueError("Player not found.")

        gamelog = playergamelog.PlayerGameLog(player_id=player_id, season=selected_season)
        stats_df = gamelog.get_data_frames()[0]

        if stats_df.empty:
            raise ValueError(
                f"No data for player {selected_player} in season {selected_season}."
            )

        return jsonify(stats_df.to_dict(orient="records"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()

        if user is None or not user.check_password(password):
            return 'Login failed'

        login_user(user)
        return redirect('/')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return 'Logged out.'

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        existing_user = User.query.filter_by(username=username).first()

        if existing_user is not None:
            return 'User already exists'

        user = User(username=username)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        return redirect('/login')

    return render_template('registration.html')

if __name__ == "__main__":
    with app.app_context():
        db.create_all()  # Create the database within the application context
    app.run(debug=True)
