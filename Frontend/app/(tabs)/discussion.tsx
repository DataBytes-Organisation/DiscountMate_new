import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";

// Sample discussion topics data
const discussionTopics = [
  {
    title: "Latest Tech in Supermarkets",
    date: "August 10, 2024",
    description:
      "Discuss the newest technologies being implemented in supermarkets around the world.",
    commentsCount: 15,
    likes: 0,
    dislikes: 0,
    comments: [
      {
        user: "Techie123",
        comment:
          "It's incredible how AI is being used to manage stock levels now!",
        likes: 0,
        dislikes: 0,
      },
      {
        user: "GroceryGuru",
        comment:
          "I saw a robot assisting customers at my local store. The future is here.",
        likes: 0,
        dislikes: 0,
      },
    ],
  },
  {
    title: "Budgeting Tips for Families",
    date: "August 9, 2024",
    description:
      "Share your best budgeting tips that help save money for families.",
    commentsCount: 22,
    likes: 0,
    dislikes: 0,
    comments: [
      {
        user: "SaveMore",
        comment: "Planning meals ahead really helps cut costs!",
        likes: 0,
        dislikes: 0,
      },
      {
        user: "FamilyFirst",
        comment: "We started buying in bulk, saves a lot of money.",
        likes: 0,
        dislikes: 0,
      },
    ],
  },
  // Add more discussion topics here
];

const DiscussionPage = () => {
  const [topics, setTopics] = useState(discussionTopics);
  const [visibleComments, setVisibleComments] = useState(
    topics.map(() => false)
  );
  const [newComment, setNewComment] = useState(topics.map(() => ""));

  const toggleComments = (index) => {
    const newVisibleComments = [...visibleComments];
    newVisibleComments[index] = !newVisibleComments[index];
    setVisibleComments(newVisibleComments);
  };

  const handleCommentChange = (index, value) => {
    const newComments = [...newComment];
    newComments[index] = value;
    setNewComment(newComments);
  };

  const addComment = (index) => {
    if (newComment[index].trim() === "") return;

    const updatedTopics = [...topics];
    updatedTopics[index].comments.push({
      user: "NewUser",
      comment: newComment[index],
      likes: 0,
      dislikes: 0,
    });
    updatedTopics[index].commentsCount += 1;
    setTopics(updatedTopics);
    setNewComment(topics.map(() => ""));
  };

  const likePost = (index) => {
    const updatedTopics = [...topics];
    updatedTopics[index].likes += 1;
    setTopics(updatedTopics);
  };

  const dislikePost = (index) => {
    const updatedTopics = [...topics];
    updatedTopics[index].dislikes += 1;
    setTopics(updatedTopics);
  };

  const likeComment = (topicIndex, commentIndex) => {
    const updatedTopics = [...topics];
    updatedTopics[topicIndex].comments[commentIndex].likes += 1;
    setTopics(updatedTopics);
  };

  const dislikeComment = (topicIndex, commentIndex) => {
    const updatedTopics = [...topics];
    updatedTopics[topicIndex].comments[commentIndex].dislikes += 1;
    setTopics(updatedTopics);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Discussion Topics</Text>
      {topics.map((topic, index) => (
        <View key={index} style={styles.post}>
          <View style={styles.textContainer}>
            <Text style={styles.postTitle}>{topic.title}</Text>
            <Text style={styles.postDate}>{topic.date}</Text>
            <Text style={styles.postDescription}>{topic.description}</Text>
            <View style={styles.interactionContainer}>
              <View style={styles.likeDislikeContainer}>
                <TouchableOpacity onPress={() => likePost(index)}>
                  <Text style={styles.buttonText}>👍 {topic.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => dislikePost(index)}>
                  <Text style={styles.buttonText}>👎 {topic.dislikes}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.button}
                onPress={() => toggleComments(index)}
              >
                <Text style={styles.buttonText}>
                  {topic.commentsCount} Comments
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
            {visibleComments[index] && (
              <>
                {topic.comments.map((comment, idx) => (
                  <View key={idx} style={styles.comment}>
                    <Text style={styles.commentUser}>{comment.user}:</Text>
                    <Text style={styles.commentText}>{comment.comment}</Text>
                    <View style={styles.likeDislikeContainer}>
                      <TouchableOpacity onPress={() => likeComment(index, idx)}>
                        <Text style={styles.buttonText}>
                          👍 {comment.likes}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => dislikeComment(index, idx)}
                      >
                        <Text style={styles.buttonText}>
                          👎 {comment.dislikes}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View style={styles.commentInputContainer}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a comment..."
                    value={newComment[index]}
                    onChangeText={(text) => handleCommentChange(index, text)}
                  />
                  <TouchableOpacity
                    style={styles.commentButton}
                    onPress={() => addComment(index)}
                  >
                    <Text style={styles.commentButtonText}>Comment</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  post: {
    backgroundColor: "#ffffff",
    marginBottom: 20,
    borderRadius: 8,
    padding: 10,
  },
  textContainer: {
    flex: 1,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  postDate: {
    fontSize: 14,
    color: "#888",
    marginVertical: 4,
  },
  postDescription: {
    fontSize: 16,
  },
  interactionContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  likeDislikeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 80,
  },
  button: {
    padding: 8,
    backgroundColor: "#e1e1e1",
    borderRadius: 4,
  },
  buttonText: {
    fontSize: 14,
  },
  comment: {
    marginTop: 5,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderColor: "#ccc",
  },
  commentUser: {
    fontWeight: "bold",
  },
  commentText: {
    fontSize: 14,
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  commentInput: {
    flex: 1,
    padding: 8,
    backgroundColor: "#e1e1e1",
    borderRadius: 4,
  },
  commentButton: {
    marginLeft: 8,
    padding: 8,
    backgroundColor: "#4caf50",
    borderRadius: 4,
  },
  commentButtonText: {
    color: "#ffffff",
    fontSize: 14,
  },
});

export default DiscussionPage;
