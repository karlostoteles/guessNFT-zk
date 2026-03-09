mod constants;
mod errors;
mod events;
mod interfaces {
    mod game_actions;
    mod verifier;
}
mod models {
    mod game;
}
mod systems {
    mod game_actions;
}

#[cfg(test)]
mod tests {
    mod setup;
    mod test_game_flow;
}
