package org.vrspace.server;

import java.math.BigInteger;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;

import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.RemoteCall;
import org.web3j.protocol.core.RemoteFunctionCall;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.tx.Contract;
import org.web3j.tx.TransactionManager;
import org.web3j.tx.gas.ContractGasProvider;

/**
 * <p>
 * Auto generated code.
 * <p>
 * <strong>Do not modify!</strong>
 * <p>
 * Please use the <a href="https://docs.web3j.io/command_line.html">web3j
 * command line tools</a>, or the
 * org.web3j.codegen.SolidityFunctionWrapperGenerator in the
 * <a href="https://github.com/web3j/web3j/tree/master/codegen">codegen
 * module</a> to update.
 *
 * <p>
 * Generated with web3j version 1.4.1.
 */
@SuppressWarnings("rawtypes")
public class NameRegistry extends Contract {
  public static final String BINARY = "0x608060405234801561001057600080fd5b5061068c806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80637b59af161461003b578063bfafff5b1461006b575b600080fd5b610055600480360381019061005091906103f2565b61009b565b60405161006291906104c7565b60405180910390f35b610085600480360381019061008091906103b1565b6102ea565b60405161009291906104ac565b60405180910390f35b6000806000846040516100ae9190610495565b90815260200160405180910390206040518060400160405290816000820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020016001820160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815250509050600073ffffffffffffffffffffffffffffffffffffffff16816020015173ffffffffffffffffffffffffffffffffffffffff1614156101f65760405180604001604052803373ffffffffffffffffffffffffffffffffffffffff1681526020018473ffffffffffffffffffffffffffffffffffffffff16815250905061022f565b82816020019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff16815250505b806000856040516102409190610495565b908152602001604051809103902060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555060208201518160010160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550905050600191505092915050565b600080826040516102fb9190610495565b908152602001604051809103902060010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169050919050565b600061034761034284610507565b6104e2565b90508281526020810184848401111561035f57600080fd5b61036a84828561058c565b509392505050565b6000813590506103818161063f565b92915050565b600082601f83011261039857600080fd5b81356103a8848260208601610334565b91505092915050565b6000602082840312156103c357600080fd5b600082013567ffffffffffffffff8111156103dd57600080fd5b6103e984828501610387565b91505092915050565b6000806040838503121561040557600080fd5b600083013567ffffffffffffffff81111561041f57600080fd5b61042b85828601610387565b925050602061043c85828601610372565b9150509250929050565b61044f8161054e565b82525050565b61045e81610560565b82525050565b600061046f82610538565b6104798185610543565b935061048981856020860161059b565b80840191505092915050565b60006104a18284610464565b915081905092915050565b60006020820190506104c16000830184610446565b92915050565b60006020820190506104dc6000830184610455565b92915050565b60006104ec6104fd565b90506104f882826105ce565b919050565b6000604051905090565b600067ffffffffffffffff821115610522576105216105ff565b5b61052b8261062e565b9050602081019050919050565b600081519050919050565b600081905092915050565b60006105598261056c565b9050919050565b60008115159050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b82818337600083830152505050565b60005b838110156105b957808201518184015260208101905061059e565b838111156105c8576000848401525b50505050565b6105d78261062e565b810181811067ffffffffffffffff821117156105f6576105f56105ff565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b6000601f19601f8301169050919050565b6106488161054e565b811461065357600080fd5b5056fea26469706673582212203d7d6852980c790e1948efba1ae231fccb52992c61bc5dd09677e211b59f093b64736f6c63430008010033";

  public static final String FUNC_GETCONTRACTDETAILS = "getContractDetails";

  public static final String FUNC_REGISTERNAME = "registerName";

  protected static final HashMap<String, String> _addresses;

  static {
    _addresses = new HashMap<String, String>();
  }

  @Deprecated
  protected NameRegistry(String contractAddress, Web3j web3j, Credentials credentials, BigInteger gasPrice,
      BigInteger gasLimit) {
    super(BINARY, contractAddress, web3j, credentials, gasPrice, gasLimit);
  }

  protected NameRegistry(String contractAddress, Web3j web3j, Credentials credentials,
      ContractGasProvider contractGasProvider) {
    super(BINARY, contractAddress, web3j, credentials, contractGasProvider);
  }

  @Deprecated
  protected NameRegistry(String contractAddress, Web3j web3j, TransactionManager transactionManager,
      BigInteger gasPrice, BigInteger gasLimit) {
    super(BINARY, contractAddress, web3j, transactionManager, gasPrice, gasLimit);
  }

  protected NameRegistry(String contractAddress, Web3j web3j, TransactionManager transactionManager,
      ContractGasProvider contractGasProvider) {
    super(BINARY, contractAddress, web3j, transactionManager, contractGasProvider);
  }

  public RemoteFunctionCall<String> getContractDetails(String name) {
    final Function function = new Function(FUNC_GETCONTRACTDETAILS,
        Arrays.<Type>asList(new org.web3j.abi.datatypes.Utf8String(name)),
        Arrays.<TypeReference<?>>asList(new TypeReference<Address>() {
        }));
    return executeRemoteCallSingleValueReturn(function, String.class);
  }

  public RemoteFunctionCall<TransactionReceipt> registerName(String name, String addr) {
    final Function function = new Function(FUNC_REGISTERNAME,
        Arrays.<Type>asList(new org.web3j.abi.datatypes.Utf8String(name), new org.web3j.abi.datatypes.Address(addr)),
        Collections.<TypeReference<?>>emptyList());
    return executeRemoteCallTransaction(function);
  }

  @Deprecated
  public static NameRegistry load(String contractAddress, Web3j web3j, Credentials credentials, BigInteger gasPrice,
      BigInteger gasLimit) {
    return new NameRegistry(contractAddress, web3j, credentials, gasPrice, gasLimit);
  }

  @Deprecated
  public static NameRegistry load(String contractAddress, Web3j web3j, TransactionManager transactionManager,
      BigInteger gasPrice, BigInteger gasLimit) {
    return new NameRegistry(contractAddress, web3j, transactionManager, gasPrice, gasLimit);
  }

  public static NameRegistry load(String contractAddress, Web3j web3j, Credentials credentials,
      ContractGasProvider contractGasProvider) {
    return new NameRegistry(contractAddress, web3j, credentials, contractGasProvider);
  }

  public static NameRegistry load(String contractAddress, Web3j web3j, TransactionManager transactionManager,
      ContractGasProvider contractGasProvider) {
    return new NameRegistry(contractAddress, web3j, transactionManager, contractGasProvider);
  }

  public static RemoteCall<NameRegistry> deploy(Web3j web3j, Credentials credentials,
      ContractGasProvider contractGasProvider) {
    return deployRemoteCall(NameRegistry.class, web3j, credentials, contractGasProvider, BINARY, "");
  }

  @Deprecated
  public static RemoteCall<NameRegistry> deploy(Web3j web3j, Credentials credentials, BigInteger gasPrice,
      BigInteger gasLimit) {
    return deployRemoteCall(NameRegistry.class, web3j, credentials, gasPrice, gasLimit, BINARY, "");
  }

  public static RemoteCall<NameRegistry> deploy(Web3j web3j, TransactionManager transactionManager,
      ContractGasProvider contractGasProvider) {
    return deployRemoteCall(NameRegistry.class, web3j, transactionManager, contractGasProvider, BINARY, "");
  }

  @Deprecated
  public static RemoteCall<NameRegistry> deploy(Web3j web3j, TransactionManager transactionManager, BigInteger gasPrice,
      BigInteger gasLimit) {
    return deployRemoteCall(NameRegistry.class, web3j, transactionManager, gasPrice, gasLimit, BINARY, "");
  }

  protected String getStaticDeployedAddress(String networkId) {
    return _addresses.get(networkId);
  }

  public static String getPreviouslyDeployedAddress(String networkId) {
    return _addresses.get(networkId);
  }
}
