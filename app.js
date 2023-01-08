const express = require("express");
const path = require("path");
const app = express();
module.exports = app;
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;
app.use(express.json());
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SUJAN_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const us = await db.get(selectUserQuery);
  if (us !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
      INSERT INTO 
        user (username, name, password, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}'
        )`;
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      response.status(200);
      response.send("User created successfully");
    }
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const q = `select * from user where username='${username}';`;
  const us = await db.get(q);
  if (us === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const checkup = await bcrypt.compare(password, us.password);
    if (checkup === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SUJAN_TOKEN");
      response.send({ jwtToken });
    }
  }
});

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  let username = request.username;
  //   console.log(username);
  const getUser = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUser);
  const getFollowing = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
  const getFollowingId = await db.all(getFollowing);
  const getFollowerIdsSimple = getFollowingId.map((each) => {
    return each.following_user_id;
  });
  const q = `select user.username, tweet.tweet, tweet.date_time as dateTime 
      from user inner join tweet 
      on user.user_id= tweet.user_id where user.user_id in (${getFollowerIdsSimple})
       order by tweet.date_time desc limit 4;`;
  const responseResult = await db.all(q);
  console.log(responseResult);
  response.send(responseResult);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  let username = request.username;
  const getUser = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUser);
  const getFollowing = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
  const getFollowingId = await db.all(getFollowing);
  const getFollowerIdsSimple = getFollowingId.map((each) => {
    return each.following_user_id;
  });
  const q = `select name from user where user_id in (${getFollowerIdsSimple});`;
  const responseResult = await db.all(q);
  response.send(responseResult);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let username = request.username;
  const getUser = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUser);
  const getFollowing = `select follower_user_id from follower where following_user_id=${getUserId.user_id};`;
  const getFollowingId = await db.all(getFollowing);
  const getFollowerIdsSimple = getFollowingId.map((each) => {
    return each.follower_user_id;
  });
  const q = `select name from user where user_id in (${getFollowerIdsSimple});`;
  const responseResult = await db.all(q);
  response.send(responseResult);
});

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  let username = request.username;
  const getUser = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUser);
  const getFollowing = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
  const getFollowingId = await db.all(getFollowing);
  const getFollowerIdsSimple = getFollowingId.map((each) => {
    return each.following_user_id;
  });
  console.log(getFollowerIdsSimple);
  if (tweetId in getFollowerIdsSimple) {
    const cl = `select count(like_id) as likes from like where tweet_id=${tweetId};`;
    const q2 = await db.all(cl);
    const cr = `select count(reply_id) as replies from reply where tweet_id=${tweetId};`;
    const q3 = await db.all(cr);
    const d = `select tweet,date_time as dateTime from tweet where tweet_id=${tweetId};`;
    const q1 = await db.get(d);
    const ans = {
      tweet: q1.tweet,
      likes: q2[0].likes,
      replies: q3[0].replies,
      dateTime: q1.dateTime,
    };
    response.send(ans);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let username = request.username;
    const getUser = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUser);
    const getFollowing = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
    const getFollowingId = await db.all(getFollowing);
    const getFollowerIdsSimple = getFollowingId.map((each) => {
      return each.following_user_id;
    });
    if (tweetId in getFollowerIdsSimple) {
      const q = `select user.username from user left join like on user.user_id=like.user_id where like.tweet_id=${tweetId};`;
      const names = await db.all(q);
      response.send({
        likes: names.map((each) => {
          return each.username;
        }),
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let username = request.username;
    const getUser = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUser);
    const getFollowing = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
    const getFollowingId = await db.all(getFollowing);
    const getFollowingIds = getFollowingId.map((each) => {
      return each.following_user_id;
    });
    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });

    if (tweetId in getTweetIds) {
      const q = `select user.name as name,reply.reply as reply from reply left join user on reply.user_id=user.user_id
        where reply.tweet_id=${tweetId};`;
      const replies = await db.all(q);
      response.send({ replies });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let username = request.username;
  const getUser = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUser);
  console.log(getUserId);
  const tweet = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
  const tweetId = await db.all(tweet);
  console.log(tweetId);
  const tweetIds = tweetId.map((each) => {
    return each.tweet_id;
  });
  console.log(tweetIds);
  const cl = `select count(like.like_id) as likes from like where tweet_id in (${tweetIds}) group by tweet_id;`;
  const q2 = await db.all(cl);
  //   const lc = q2.reduce((a, b) => a.likes + b.likes);
  //   console.log(lc);
  const cr = `select count(reply.reply_id) as replies from reply where tweet_id in (${tweetIds}) group by tweet_id;`;
  const q3 = await db.all(cr);
  //   const rc = q2.reduce((a, b) => a.replies + b.replies);
  //   console.log(rc);
  const d = `select tweet,date_time as dateTime from tweet where user_id=${getUserId.user_id};`;
  const q1 = await db.all(d);
  //   console.log(q1, q2, q3);
  let ans = [],
    i;
  for (i = 0; i < q1.length; i++) {
    ans.push({
      tweet: q1[i].tweet,
      likes: q2[i].likes,
      replies: q3[i].replies,
      dateTime: q1[i].dateTime,
    });
  }
  console.log(ans);
  response.send(ans);
});

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId.user_id);
  const { tweet } = request.body;
  //console.log(tweet);
  //const currentDate = format(new Date(), "yyyy-MM-dd HH-mm-ss");
  const currentDate = new Date();
  console.log(currentDate.toISOString().replace("T", " "));

  const postRequestQuery = `insert into tweet(tweet, user_id, date_time) values ("${tweet}", ${getUserId.user_id}, '${currentDate}');`;

  const responseResult = await db.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  response.send("Created a Tweet");
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    //console.log(tweetId);
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    //console.log(getUserId.user_id);
    //tweets made by the user
    const getTweetsListQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
    const getTweetsListArray = await db.all(getTweetsListQuery);
    const getTweetsList = getTweetsListArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(getTweetsList);
    if (getTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `delete from tweet where tweet_id=${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
