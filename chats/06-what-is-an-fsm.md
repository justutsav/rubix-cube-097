# What's this FSM, I don't know about this

## Query

> okay now I wil discussing the diagram one by one let's firstly talk about the Master flow: Only give me the info which I asked, in layman's term until I specifically ask for the details in techinical terms. what's this FSM I don't know about this.

## Reply

FSM = **finite state machine**.

Means: the conversation is always sitting at exactly **one step**, and from that step only a few next steps are allowed. Nothing else can happen.

Like an ATM. You're on "enter PIN". You can go to "choose account" or back to "card rejected". You cannot suddenly land on "print statement". The machine knows where it is at all times.

Our call is the same:

> ask consent → question 1 → question 2 → … → question 7 → read it all back → give recommendation → hang up

At every moment the system knows "this caller is at question 4". That's the state. It writes it down. So if the call drops, we know exactly where to restart.

The alternative would be letting the AI freestyle and decide what to ask next. We don't — because then it can skip a question, invent an extra one, or ask them in a different order every time, and you can never prove afterwards what happened.
