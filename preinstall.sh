export CODEARTIFACT_AUTH_TOKEN=`aws codeartifact get-authorization-token --domain stepinto --domain-owner 913697957162 --region us-west-2 --query authorizationToken --output text --profile stepinto`

yarn config set 'npmRegistries["https://stepinto-913697957162.d.codeartifact.us-west-2.amazonaws.com/npm/stepinto/"].npmAuthToken' "${CODEARTIFACT_AUTH_TOKEN}"
echo "registry=https://stepinto-913697957162.d.codeartifact.us-west-2.amazonaws.com/npm/stepinto/ //stepinto-913697957162.d.codeartifact.us-west-2.amazonaws.com/npm/stepinto/:always-auth=true
  //stepinto-913697957162.d.codeartifact.us-west-2.amazonaws.com/npm/stepinto/:_authToken=$CODEARTIFACT_AUTH_TOKEN" > .npmrc
