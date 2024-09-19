const request = require("supertest");
const mongoose = require("mongoose");
const app = require("./index.test"); // Use the test version of the app
const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");
const Reply = require("../models/Reply");

// Increase Jest timeout (30 seconds)
jest.setTimeout(30000);

// Test Users, Posts, Comments, and Replies
const users = {
  normalUser1: {
    useremail: "normal1@example.com",
    password: "password123",
    user_fname: "Normal",
    user_lname: "UserOne",
    address: "123 Street One",
    phone_number: "1111111111",
    admin: false,
  },
  normalUser2: {
    useremail: "normal2@example.com",
    password: "password123",
    user_fname: "Normal",
    user_lname: "UserTwo",
    address: "123 Street Two",
    phone_number: "2222222222",
    admin: false,
  },
  adminUser: {
    useremail: "admin@example.com",
    password: "admin123",
    user_fname: "Admin",
    user_lname: "User",
    address: "Admin Street",
    phone_number: "9999999999",
    admin: true,
  },
};

const posts = {
  validPost1: {
    title: "Valid Post 1",
    description: "This is a valid post 1.",
  },
};

const comments = {
  validComment1: {
    comment: "This is a valid comment.",
  },
};

const replies = {
  validReply1: {
    replyText: "This is a valid reply.",
  },
  updatedReply: {
    replyText: "This is an updated reply.",
  },
};

// Before running tests, connect to the test database
beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_TEST_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// After each test, clear the users, posts, comments, and replies collection
afterEach(async () => {
  await User.deleteMany({});
  await Post.deleteMany({});
  await Comment.deleteMany({});
  await Reply.deleteMany({});
});

// After all tests are done, disconnect from the test database
afterAll(async () => {
  await mongoose.connection.dropDatabase(); // Drop the test database to ensure it's clean
  await mongoose.connection.close();
});

describe("Reply API Tests", () => {
  let tokenUser1, tokenUser2, tokenAdmin;
  let postId1;
  let userId1, userId2, adminUserId;
  let commentId1;
  let replyId1;

  // Before each test, create normal users, an admin, a post, and a comment
  beforeEach(async () => {
    // Create Normal User 1 and get token
    const signupResUser1 = await request(app)
      .post("/api/users/signup")
      .send(users.normalUser1);
    userId1 = signupResUser1.body.userId;
    const loginResUser1 = await request(app).post("/api/users/signin").send({
      useremail: users.normalUser1.useremail,
      password: users.normalUser1.password,
    });
    tokenUser1 = loginResUser1.body.token;

    // Create Normal User 2 and get token
    const signupResUser2 = await request(app)
      .post("/api/users/signup")
      .send(users.normalUser2);
    userId2 = signupResUser2.body.userId;
    const loginResUser2 = await request(app).post("/api/users/signin").send({
      useremail: users.normalUser2.useremail,
      password: users.normalUser2.password,
    });
    tokenUser2 = loginResUser2.body.token;

    // Create Admin User and get token
    const signupResAdmin = await request(app)
      .post("/api/users/signup")
      .send(users.adminUser);
    adminUserId = signupResAdmin.body.userId;
    const loginResAdmin = await request(app).post("/api/users/signin").send({
      useremail: users.adminUser.useremail,
      password: users.adminUser.password,
    });
    tokenAdmin = loginResAdmin.body.token;

    // Create Post for Normal User 1
    const createPostRes1 = await request(app)
      .post("/api/posts/")
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(posts.validPost1);
    postId1 = createPostRes1.body._id;

    // Create Comment for Post by Normal User 1
    const createCommentRes1 = await request(app)
      .post(`/api/comments/post/${postId1}/comment`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(comments.validComment1);
    commentId1 = createCommentRes1.body._id;

    // Create Reply for Comment by Normal User 1
    const createReplyRes1 = await request(app)
      .post(`/api/replies/comment/${commentId1}/reply`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(replies.validReply1);
    replyId1 = createReplyRes1.body.reply._id;
  });

  /**
   * ====================
   * Add Reply Test Cases
   * ====================
   */
  it("should add a reply successfully", async () => {
    const res = await request(app)
      .post(`/api/replies/comment/${commentId1}/reply`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(replies.validReply1);

    expect(res.statusCode).toEqual(201);
    expect(res.body.reply).toHaveProperty("_id");
    expect(res.body.reply.replyText).toBe(replies.validReply1.replyText);
  });

  it("should fail to add a reply without a token", async () => {
    const res = await request(app)
      .post(`/api/replies/comment/${commentId1}/reply`)
      .send(replies.validReply1);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to add a reply with missing reply content", async () => {
    const res = await request(app)
      .post(`/api/replies/comment/${commentId1}/reply`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send({ replyText: "" });

    expect(res.statusCode).toEqual(400);
    expect(res.body.errors[0].msg).toBe("Reply content is required");
  });

  /**
   * ====================
   * Get All Replies Test Cases
   * ====================
   */
  it("should get all replies for a comment", async () => {
    const res = await request(app)
      .get(`/api/replies/comment/${commentId1}/replies`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("should fail to get replies without a token", async () => {
    const res = await request(app).get(
      `/api/replies/comment/${commentId1}/replies`
    );

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to get replies for a non-existent comment", async () => {
    const nonExistentCommentId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/replies/comment/${nonExistentCommentId}/replies`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toEqual([]); // Assuming no replies will return an empty array
  });

  /**
   * ====================
   * Update Reply Test Cases
   * ====================
   */
  it("should update a reply successfully", async () => {
    const res = await request(app)
      .put(`/api/replies/reply/${replyId1}`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(replies.updatedReply);

    expect(res.statusCode).toEqual(200);
    expect(res.body.reply.replyText).toBe(replies.updatedReply.replyText);
  });

  it("should not allow a user to update another user's reply", async () => {
    const res = await request(app)
      .put(`/api/replies/reply/${replyId1}`)
      .set("Authorization", `Bearer ${tokenUser2}`)
      .send(replies.updatedReply);

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty("message", "Unauthorized action");
  });

  it("should fail to update a reply without a token", async () => {
    const res = await request(app)
      .put(`/api/replies/reply/${replyId1}`)
      .send(replies.updatedReply);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to update a non-existent reply", async () => {
    const nonExistentReplyId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/replies/reply/${nonExistentReplyId}`)
      .set("Authorization", `Bearer ${tokenUser1}`)
      .send(replies.updatedReply);

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "Reply not found");
  });

  /**
   * ====================
   * Delete Reply Test Cases
   * ====================
   */
  it("should delete a reply successfully", async () => {
    const res = await request(app)
      .delete(`/api/replies/reply/${replyId1}`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("message", "Reply deleted successfully");
  });

  it("should not allow a user to delete another user's reply", async () => {
    const res = await request(app)
      .delete(`/api/replies/reply/${replyId1}`)
      .set("Authorization", `Bearer ${tokenUser2}`);

    expect(res.statusCode).toEqual(403);
    expect(res.body).toHaveProperty("message", "Unauthorized action");
  });

  it("should fail to delete a reply without a token", async () => {
    const res = await request(app).delete(`/api/replies/reply/${replyId1}`);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to delete a non-existent reply", async () => {
    const nonExistentReplyId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/replies/reply/${nonExistentReplyId}`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "Reply not found");
  });
  /**
   * ====================
   * Like/Unlike/Dislike/Undislike Reply Test Cases
   * ====================
   */
  it("should like a reply successfully with a valid token", async () => {
    const res = await request(app)
      .put(`/api/replies/reply/${replyId1}/like`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.likes).toBe(1);
  });

  it("should fail to like a reply without a token", async () => {
    const res = await request(app).put(`/api/replies/reply/${replyId1}/like`);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to like a reply that is already liked by the user", async () => {
    await request(app)
      .put(`/api/replies/reply/${replyId1}/like`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    const res = await request(app)
      .put(`/api/replies/reply/${replyId1}/like`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty(
      "message",
      "You have already liked this reply"
    );
  });

  it("should fail to like a reply with an invalid reply ID", async () => {
    const nonExistentReplyId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/replies/reply/${nonExistentReplyId}/like`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "Reply not found");
  });

  // Unlike a Reply
  it("should unlike a reply successfully with a valid token", async () => {
    await request(app)
      .put(`/api/replies/reply/${replyId1}/like`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    const res = await request(app)
      .put(`/api/replies/reply/${replyId1}/unlike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.likes).toBe(0);
  });

  it("should fail to unlike a reply without a token", async () => {
    const res = await request(app).put(`/api/replies/reply/${replyId1}/unlike`);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to unlike a reply that hasn't been liked by the user", async () => {
    const res = await request(app)
      .put(`/api/replies/reply/${replyId1}/unlike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty("message", "You haven't liked this reply");
  });

  it("should fail to unlike a reply with an invalid reply ID", async () => {
    const nonExistentReplyId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/replies/reply/${nonExistentReplyId}/unlike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "Reply not found");
  });

  // Dislike a Reply
  it("should dislike a reply successfully with a valid token", async () => {
    const res = await request(app)
      .put(`/api/replies/reply/${replyId1}/dislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.dislikes).toBe(1);
  });

  it("should fail to dislike a reply without a token", async () => {
    const res = await request(app).put(
      `/api/replies/reply/${replyId1}/dislike`
    );

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to dislike a reply that is already disliked by the user", async () => {
    await request(app)
      .put(`/api/replies/reply/${replyId1}/dislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    const res = await request(app)
      .put(`/api/replies/reply/${replyId1}/dislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty(
      "message",
      "You have already disliked this reply"
    );
  });

  it("should fail to dislike a reply with an invalid reply ID", async () => {
    const nonExistentReplyId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/replies/reply/${nonExistentReplyId}/dislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "Reply not found");
  });

  // Undislike a Reply
  it("should undislike a reply successfully with a valid token", async () => {
    await request(app)
      .put(`/api/replies/reply/${replyId1}/dislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    const res = await request(app)
      .put(`/api/replies/reply/${replyId1}/undislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.dislikes).toBe(0);
  });

  it("should fail to undislike a reply without a token", async () => {
    const res = await request(app).put(
      `/api/replies/reply/${replyId1}/undislike`
    );

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty("message", "No token provided");
  });

  it("should fail to undislike a reply that hasn't been disliked by the user", async () => {
    const res = await request(app)
      .put(`/api/replies/reply/${replyId1}/undislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty(
      "message",
      "You haven't disliked this reply"
    );
  });

  it("should fail to undislike a reply with an invalid reply ID", async () => {
    const nonExistentReplyId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/replies/reply/${nonExistentReplyId}/undislike`)
      .set("Authorization", `Bearer ${tokenUser1}`);

    expect(res.statusCode).toEqual(404);
    expect(res.body).toHaveProperty("message", "Reply not found");
  });
});
