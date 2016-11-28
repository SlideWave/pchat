import React, {Component, PropTypes} from 'react';
import ClearFix from 'material-ui/internal/ClearFix';
import withWidth, {SMALL, LARGE} from 'material-ui/utils/withWidth';


class ConversationHeader extends Component {
  static propTypes = {
    style: PropTypes.object,
    title: PropTypes.string.isRequired
  };

  static defaultProps = {
    useContent: false,
    contentType: 'div',
  };

  getStyles() {
    return {
      root: {
        padding: 0,
        boxSizing: 'border-box',
        width: '100%'
      },

      content: {
        maxWidth: 1200,
        margin: '0 auto',
      }
    };
  }

  render() {
    const {
      style,
      ...other
    } = this.props;

    const styles = this.getStyles();

    return (
      <div
        style={Object.assign(
          styles.root,
          style)}
      >
        {this.props.title}
      </div>
    );
  }
}

export default ConversationHeader;
