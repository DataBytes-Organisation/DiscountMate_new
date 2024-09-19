import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://localhost:5000/api"; // Replace with your backend API URL

const DiscussionPage = () => {
  const [topics, setTopics] = useState([]);
  const [visibleComments, setVisibleComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [replies, setReplies] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState(null);

  // Fetch discussion topics from the backend on component mount
  useEffect(() => {
    fetchTopics();
  }, [sortBy]);

  const fetchTopics = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${API_URL}/posts?sort=${sortBy}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Error fetching posts");
      const data = await response.json();

      // Initialize comments as empty arrays to avoid undefined errors
      if (Array.isArray(data)) {
        setTopics(
          data.map((topic) => ({
            ...topic,
            comments: topic.comments || [],
          }))
        );
      } else {
        setTopics([]);
      }
    } catch (error) {
      console.error("Error fetching topics:", error);
      setTopics([]);
    }
  };

  const fetchComments = async (postId, index) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) throw new Error("No auth token found");

      const response = await fetch(
        `${API_URL}/comments/post/${postId}/comments`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) throw new Error("Failed to load comments");
      const comments = await response.json();

      const updatedTopics = [...topics];
      updatedTopics[index].comments = comments || [];
      setTopics(updatedTopics);
    } catch (error) {
      console.error("Error loading comments:", error);
    }
  };

  const toggleComments = (index) => {
    const postId = topics[index]._id;
    if (!visibleComments[index]) {
      fetchComments(postId, index);
    }
    setVisibleComments((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const handleCommentChange = (index, value) => {
    setNewComment((prev) => ({ ...prev, [index]: value }));
  };

  const addComment = async (postId, index) => {
    if (newComment[index]?.trim() === "") return;

    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) throw new Error("No auth token found");

      const response = await fetch(
        `${API_URL}/comments/post/${postId}/comment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ comment: newComment[index] }),
        }
      );

      if (!response.ok) throw new Error("Failed to add comment");
      const commentData = await response.json();

      const updatedTopics = [...topics];
      updatedTopics[index].comments.push(commentData);
      setTopics(updatedTopics);
      setNewComment((prev) => ({ ...prev, [index]: "" }));
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const deleteComment = async (commentId, topicIndex, commentIndex) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${API_URL}/comments/comment/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to delete comment");

      const updatedTopics = [...topics];
      updatedTopics[topicIndex].comments.splice(commentIndex, 1);
      setTopics(updatedTopics);
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const replyToComment = async (commentId, value, topicIndex, commentIndex) => {
    if (value.trim() === "") return;

    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) throw new Error("No auth token found");

      const response = await fetch(
        `${API_URL}/replies/comment/${commentId}/reply`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ replyText: value }),
        }
      );

      if (!response.ok) throw new Error("Failed to add reply");
      const replyData = await response.json();

      const updatedTopics = [...topics];
      updatedTopics[topicIndex].comments[commentIndex].replies.push(
        replyData.reply
      );
      setTopics(updatedTopics);
      setReplies((prev) => ({ ...prev, [commentIndex]: "" }));
    } catch (error) {
      console.error("Error adding reply:", error);
    }
  };

  const deleteReply = async (replyId, topicIndex, commentIndex, replyIndex) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      if (!token) throw new Error("No auth token found");

      const response = await fetch(`${API_URL}/replies/reply/${replyId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) throw new Error("Failed to delete reply");

      const updatedTopics = [...topics];
      updatedTopics[topicIndex].comments[commentIndex].replies.splice(
        replyIndex,
        1
      );
      setTopics(updatedTopics);
    } catch (error) {
      console.error("Error deleting reply:", error);
    }
  };

  const handleReplyChange = (index, value) => {
    setReplies((prev) => ({ ...prev, [index]: value }));
  };

  const sortTopics = (sortType) => {
    setSortBy(sortType === sortBy ? null : sortType);
  };

  const filteredTopics = topics.filter((topic) =>
    topic.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.pageTitle}>Discussion Topics</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search topics..."
        value={searchTerm}
        onChangeText={(text) => setSearchTerm(text)}
      />

      <View style={styles.sortContainer}>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === "likes" && styles.sortActive]}
          onPress={() => sortTopics("likes")}
        >
          <Text style={styles.buttonText}>Sort by Likes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.sortButton,
            sortBy === "comments" && styles.sortActive,
          ]}
          onPress={() => sortTopics("comments")}
        >
          <Text style={styles.buttonText}>Sort by Comments</Text>
        </TouchableOpacity>
      </View>

      {filteredTopics.map((topic, index) => (
        <View key={topic._id} style={styles.post}>
          <View style={styles.textContainer}>
            <Text style={styles.postTitle}>{topic.title}</Text>
            <Text style={styles.postDate}>
              {new Date(topic.date).toDateString()}
            </Text>
            <Text style={styles.postDescription}>{topic.description}</Text>
            <View style={styles.interactionContainer}>
              <View style={styles.likeDislikeContainer}>
                <TouchableOpacity onPress={() => likePost(topic._id, index)}>
                  <Text style={styles.buttonText}>👍 {topic.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => dislikePost(topic._id, index)}>
                  <Text style={styles.buttonText}>👎 {topic.dislikes}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.button}
                onPress={() => toggleComments(index)}
              >
                <Text style={styles.buttonText}>
                  {topic.comments?.length || 0} Comments
                </Text>
              </TouchableOpacity>
            </View>

            {visibleComments[index] && (
              <>
                {(topic.comments || []).map((comment, cIndex) => (
                  <View key={comment._id || cIndex} style={styles.comment}>
                    <Text style={styles.commentUser}>
                      {comment.user
                        ? `${comment.user.user_fname || "Unknown"} ${
                            comment.user.user_lname || "User"
                          }`
                        : "Unknown User"}
                      :
                    </Text>

                    <Text style={styles.commentText}>
                      {comment.comment ? comment.comment : ""}
                    </Text>

                    <View style={styles.likeDislikeContainer}>
                      <TouchableOpacity
                        onPress={() => likeComment(index, comment._id, cIndex)}
                      >
                        <Text style={styles.buttonText}>
                          👍 {comment.likes}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          dislikeComment(index, comment._id, cIndex)
                        }
                      >
                        <Text style={styles.buttonText}>
                          👎 {comment.dislikes}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() =>
                          deleteComment(comment._id, index, cIndex)
                        }
                      >
                        <Text style={styles.buttonText}>🗑 Delete</Text>
                      </TouchableOpacity>
                    </View>

                    {(comment.replies || []).map((reply, rIndex) => (
                      <View key={reply._id || rIndex} style={styles.reply}>
                        <Text style={styles.replyUser}>
                          {reply.user
                            ? `${reply.user.user_fname || "Anonymous"} ${
                                reply.user.user_lname || ""
                              }`
                            : "Anonymous"}
                          :
                        </Text>

                        <Text style={styles.replyText}>
                          {reply.replyText ? reply.replyText : ""}
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            deleteReply(reply._id, index, cIndex, rIndex)
                          }
                        >
                          <Text style={styles.buttonText}>🗑 Delete Reply</Text>
                        </TouchableOpacity>
                      </View>
                    ))}

                    <View style={styles.commentInputContainer}>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Write a reply..."
                        value={replies[cIndex] || ""}
                        onChangeText={(text) => handleReplyChange(cIndex, text)}
                      />
                      <TouchableOpacity
                        style={styles.commentButton}
                        onPress={() =>
                          replyToComment(
                            comment._id,
                            replies[cIndex],
                            index,
                            cIndex
                          )
                        }
                      >
                        <Text style={styles.commentButtonText}>Reply</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
                <View style={styles.commentInputContainer}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Write a comment..."
                    value={newComment[index] || ""}
                    onChangeText={(text) => handleCommentChange(index, text)}
                  />
                  <TouchableOpacity
                    style={styles.commentButton}
                    onPress={() => addComment(topic._id, index)}
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
  searchInput: {
    padding: 8,
    backgroundColor: "#e1e1e1",
    borderRadius: 4,
    marginBottom: 10,
  },
  sortContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 10,
  },
  sortButton: {
    padding: 10,
    backgroundColor: "#d1d1d1",
    borderRadius: 4,
  },
  sortActive: {
    backgroundColor: "#4caf50",
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
  reply: {
    marginLeft: 20,
    borderLeftWidth: 1,
    borderColor: "#ddd",
    paddingLeft: 10,
  },
  replyUser: {
    fontWeight: "bold",
  },
  replyText: {
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
